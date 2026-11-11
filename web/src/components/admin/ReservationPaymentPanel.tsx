import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  computeDepositAmount,
  depositPercentForService,
} from '../../domain/freight'
import {
  depositConfirmGate,
  findActiveCharge,
  isChargePaid,
  remainingNeedsJustification,
  suggestedRemainingAmount,
  type DepositConfirmGate,
} from '../../domain/paymentCharges'
import {
  formatMoneyDraft,
  formatReservationMoney,
  hasOverridePrice,
  parseMoneyDraft,
  sanitizeMoneyTyping,
} from '../../domain/reservationPrice'
import {
  buildPaymentChargeWhatsAppUrl,
  toWhatsAppDigits,
} from '../../domain/whatsapp'
import {
  createAsaasCheckoutForCharge,
  emitDepositCharge,
  emitRemainingCharge,
  listPaymentChargesForReservation,
  markPaymentChargePaid,
} from '../../services/paymentCharges'
import type {
  FreightRule,
  PaymentCharge,
  Reservation,
} from '../../types/database'

type Props = {
  reservation: Reservation
  freightRules: FreightRule[]
  onChanged: () => void
  onError: (msg: string) => void
  onConfirmGateChange?: (gate: DepositConfirmGate) => void
}

function customerFirstName(full: string) {
  const part = full.trim().split(/\s+/)[0]
  return part || ''
}

function mapChargeError(
  code: string,
  t: (k: string, opts?: Record<string, string>) => string,
): string {
  if (code.includes('PRICE_REQUIRED')) return t('admin.payment.priceRequired')
  if (code.includes('DEPOSIT_ALREADY_ACTIVE'))
    return t('admin.payment.depositAlreadyActive')
  if (code.includes('DEPOSIT_NOT_PAID')) return t('admin.payment.depositNotPaid')
  if (code.includes('REMAINING_ALREADY_ACTIVE'))
    return t('admin.payment.remainingAlreadyActive')
  if (code.includes('REMAINING_ZERO')) return t('admin.payment.remainingZero')
  if (code.includes('JUSTIFICATION_REQUIRED'))
    return t('admin.payment.justificationRequired')
  if (code.includes('INVALID_STATUS')) return t('admin.payment.invalidStatus')
  if (code.includes('DEPOSIT_PERCENT_ZERO'))
    return t('admin.payment.depositPercentZero')
  if (code.includes('ASAAS_NOT_CONFIGURED'))
    return t('admin.payment.asaasNotConfigured')
  if (code.includes('ASAAS_INVALID_API_KEY'))
    return t('admin.payment.asaasInvalidApiKey', {
      detail: code.replace(/^[\s\S]*ASAAS_INVALID_API_KEY:?/, '').slice(0, 160),
    })
  if (code.includes('ASAAS_CHECKOUT_FAILED'))
    return t('admin.payment.asaasCheckoutFailed', {
      detail:
        code.replace(/^[\s\S]*ASAAS_CHECKOUT_FAILED:?\d*:?/, '').slice(0, 220) ||
        code,
    })
  // Edge Function 502 costuma devolver o corpo Asaas inteiro
  if (
    code.startsWith('ASAAS_') ||
    code.includes('asaas') ||
    code.includes('errors')
  )
    return t('admin.payment.asaasCheckoutFailed', { detail: code.slice(0, 220) })
  return code || t('admin.payment.error')
}

export function ReservationPaymentPanel({
  reservation: r,
  freightRules,
  onChanged,
  onError,
  onConfirmGateChange,
}: Props) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('en') ? 'en-US' : 'pt-BR'
  const waLocale = i18n.language.startsWith('en') ? 'en' : 'pt-BR'
  const [charges, setCharges] = useState<PaymentCharge[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [remainingDraft, setRemainingDraft] = useState('')
  const [justification, setJustification] = useState('')

  const depositPct = depositPercentForService(freightRules, r.service_type)
  const realPrice = hasOverridePrice(r) ? Number(r.override_price) : null
  const previewDeposit =
    realPrice != null ? computeDepositAmount(realPrice, depositPct) : 0

  const deposit = findActiveCharge(charges, 'sinal')
  const remaining = findActiveCharge(charges, 'restante')
  const depositPaid = isChargePaid(deposit)
  const depositAmount = deposit ? Number(deposit.amount) : previewDeposit
  const suggestedRemaining =
    realPrice != null
      ? suggestedRemainingAmount(
          realPrice,
          deposit ? Number(deposit.amount) : 0,
        )
      : 0

  const canEmitDeposit =
    (r.status === 'hold' || r.status === 'hold_expirado') &&
    realPrice != null &&
    !deposit

  const canEmitRemaining =
    (r.status === 'confirmado' || r.status === 'concluido') &&
    depositPaid &&
    !remaining &&
    suggestedRemaining > 0

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listPaymentChargesForReservation(r.id)
      .then((rows) => {
        if (!cancelled) setCharges(rows)
      })
      .catch((err) => {
        if (!cancelled)
          onError(err instanceof Error ? err.message : t('admin.payment.error'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [r.id, r.override_price, onError, t])

  useEffect(() => {
    if (suggestedRemaining > 0) {
      setRemainingDraft(formatMoneyDraft(suggestedRemaining))
    } else {
      setRemainingDraft('')
    }
    setJustification('')
  }, [suggestedRemaining, r.id])

  useEffect(() => {
    if (!onConfirmGateChange || loading) return
    onConfirmGateChange(depositConfirmGate(r, charges))
  }, [charges, r, loading, onConfirmGateChange])

  const remainingParsed = useMemo(
    () => parseMoneyDraft(remainingDraft),
    [remainingDraft],
  )

  function openWhatsApp(charge: PaymentCharge) {
    const url = buildPaymentChargeWhatsAppUrl(r.customer_phone, {
      serviceCode: r.service_code,
      customerFirstName: customerFirstName(r.customer_name),
      kind: charge.kind,
      amountLabel: formatReservationMoney(charge.amount, locale),
      checkoutUrl: charge.checkout_url,
      locale: waLocale,
    })
    if (!url || !toWhatsAppDigits(r.customer_phone)) {
      onError(t('admin.payment.whatsappInvalid'))
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function attachCheckout(charge: PaymentCharge): Promise<PaymentCharge> {
    const result = await createAsaasCheckoutForCharge(charge.id)
    if (result.stub || result.error === 'ASAAS_NOT_CONFIGURED') {
      throw new Error('ASAAS_NOT_CONFIGURED')
    }
    if (!result.charge?.checkout_url) {
      throw new Error(result.error || 'ASAAS_CHECKOUT_FAILED')
    }
    return result.charge
  }

  async function onGenerateCheckout(charge: PaymentCharge) {
    setBusy(true)
    onError('')
    try {
      const updated = await attachCheckout(charge)
      setCharges((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      )
      openWhatsApp(updated)
      onChanged()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      onError(mapChargeError(msg, t))
    } finally {
      setBusy(false)
    }
  }

  async function onEmitDeposit() {
    setBusy(true)
    onError('')
    try {
      let charge = await emitDepositCharge(r.id)
      charge = await attachCheckout(charge)
      setCharges((prev) => [charge, ...prev.filter((c) => c.id !== charge.id)])
      openWhatsApp(charge)
      onChanged()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      onError(mapChargeError(msg, t))
    } finally {
      setBusy(false)
    }
  }

  async function onEmitRemaining(e: FormEvent) {
    e.preventDefault()
    const amount = remainingParsed
    if (amount == null || amount <= 0) {
      onError(t('admin.payment.amountInvalid'))
      return
    }
    if (
      remainingNeedsJustification(amount, suggestedRemaining) &&
      justification.trim().length < 3
    ) {
      onError(t('admin.payment.justificationRequired'))
      return
    }
    setBusy(true)
    onError('')
    try {
      let charge = await emitRemainingCharge({
        reservationId: r.id,
        amount,
        justification,
      })
      charge = await attachCheckout(charge)
      setCharges((prev) => [charge, ...prev.filter((c) => c.id !== charge.id)])
      openWhatsApp(charge)
      onChanged()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      onError(mapChargeError(msg, t))
    } finally {
      setBusy(false)
    }
  }

  async function onMarkPaid(chargeId: string) {
    setBusy(true)
    onError('')
    try {
      const updated = await markPaymentChargePaid(chargeId)
      setCharges((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      )
      onChanged()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      onError(mapChargeError(msg, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-payment" aria-label={t('admin.payment.title')}>
      <header className="admin-payment__head">
        <h3>{t('admin.payment.title')}</h3>
        <p>{t('admin.payment.leadStub')}</p>
      </header>

      {loading ? (
        <p className="admin-payment__muted">{t('admin.payment.loading')}</p>
      ) : (
        <>
          <div className="admin-payment__block">
            <div className="admin-payment__block-top">
              <strong>{t('admin.payment.depositTitle')}</strong>
              {deposit ? (
                <span
                  className={`admin-payment__badge is-${deposit.status}`}
                >
                  {t(`admin.payment.status.${deposit.status}`)}
                </span>
              ) : (
                <span className="admin-payment__badge is-none">
                  {t('admin.payment.status.none')}
                </span>
              )}
            </div>
            <p className="admin-payment__meta">
              {deposit
                ? t('admin.payment.depositMeta', {
                    amount: formatReservationMoney(deposit.amount, locale),
                    percent: Number(deposit.deposit_percent ?? depositPct),
                  })
                : realPrice != null
                  ? t('admin.payment.depositPreview', {
                      amount: formatReservationMoney(previewDeposit, locale),
                      percent: depositPct,
                    })
                  : t('admin.payment.needRealPrice')}
            </p>
            <div className="admin-payment__actions">
              {canEmitDeposit ? (
                <button
                  type="button"
                  className="agenda-slot-modal__btn is-primary"
                  disabled={busy}
                  onClick={() => void onEmitDeposit()}
                >
                  {t('admin.payment.sendDeposit')}
                </button>
              ) : null}
              {deposit?.status === 'emitida' && !deposit.checkout_url ? (
                <button
                  type="button"
                  className="agenda-slot-modal__btn is-primary"
                  disabled={busy}
                  onClick={() => void onGenerateCheckout(deposit)}
                >
                  {t('admin.payment.generateAsaasLink')}
                </button>
              ) : null}
              {deposit?.status === 'emitida' && deposit.checkout_url ? (
                <button
                  type="button"
                  className="agenda-slot-modal__btn is-primary"
                  disabled={busy}
                  onClick={() => openWhatsApp(deposit)}
                >
                  {t('admin.payment.resendPaymentLink')}
                </button>
              ) : null}
              {deposit?.status === 'emitida' ? (
                <button
                  type="button"
                  className="agenda-slot-modal__btn"
                  disabled={busy}
                  onClick={() => void onMarkPaid(deposit.id)}
                >
                  {t('admin.payment.markPaidManual')}
                </button>
              ) : null}
            </div>
          </div>

          <div className="admin-payment__block">
            <div className="admin-payment__block-top">
              <strong>{t('admin.payment.remainingTitle')}</strong>
              {remaining ? (
                <span
                  className={`admin-payment__badge is-${remaining.status}`}
                >
                  {t(`admin.payment.status.${remaining.status}`)}
                </span>
              ) : (
                <span className="admin-payment__badge is-none">
                  {t('admin.payment.status.none')}
                </span>
              )}
            </div>
            {!depositPaid ? (
              <p className="admin-payment__meta">
                {t('admin.payment.remainingLocked')}
              </p>
            ) : remaining ? (
              <p className="admin-payment__meta">
                {t('admin.payment.remainingMeta', {
                  amount: formatReservationMoney(remaining.amount, locale),
                })}
              </p>
            ) : canEmitRemaining ? (
              <form
                className="admin-payment__remaining-form"
                onSubmit={(ev) => void onEmitRemaining(ev)}
              >
                <p className="admin-payment__meta">
                  {t('admin.payment.remainingSuggested', {
                    amount: formatReservationMoney(suggestedRemaining, locale),
                    deposit: formatReservationMoney(depositAmount, locale),
                  })}
                </p>
                <label>
                  <span>{t('admin.payment.remainingAmount')}</span>
                  <div className="admin-dispatch__money">
                    <span aria-hidden="true">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={remainingDraft}
                      disabled={busy}
                      onChange={(e) =>
                        setRemainingDraft(sanitizeMoneyTyping(e.target.value))
                      }
                      onBlur={() => {
                        const n = parseMoneyDraft(remainingDraft)
                        if (n != null && n > 0)
                          setRemainingDraft(formatMoneyDraft(n))
                      }}
                    />
                  </div>
                </label>
                {remainingParsed != null &&
                remainingNeedsJustification(
                  remainingParsed,
                  suggestedRemaining,
                ) ? (
                  <label>
                    <span>{t('admin.payment.justification')}</span>
                    <textarea
                      value={justification}
                      disabled={busy}
                      rows={3}
                      maxLength={2000}
                      onChange={(e) => setJustification(e.target.value)}
                      placeholder={t('admin.payment.justificationPlaceholder')}
                      required
                    />
                  </label>
                ) : null}
                <button
                  type="submit"
                  className="agenda-slot-modal__btn is-primary"
                  disabled={busy}
                >
                  {t('admin.payment.sendRemaining')}
                </button>
              </form>
            ) : (
              <p className="admin-payment__meta">
                {t('admin.payment.remainingUnavailable')}
              </p>
            )}
            {remaining ? (
              <div className="admin-payment__actions">
                {remaining.status === 'emitida' && !remaining.checkout_url ? (
                  <button
                    type="button"
                    className="agenda-slot-modal__btn is-primary"
                    disabled={busy}
                    onClick={() => void onGenerateCheckout(remaining)}
                  >
                    {t('admin.payment.generateAsaasLink')}
                  </button>
                ) : null}
                {remaining.checkout_url ? (
                  <button
                    type="button"
                    className="agenda-slot-modal__btn is-primary"
                    disabled={busy}
                    onClick={() => openWhatsApp(remaining)}
                  >
                    {t('admin.payment.resendPaymentLink')}
                  </button>
                ) : null}
                {remaining.status === 'emitida' ? (
                  <button
                    type="button"
                    className="agenda-slot-modal__btn"
                    disabled={busy}
                    onClick={() => void onMarkPaid(remaining.id)}
                  >
                    {t('admin.payment.markPaidManual')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
