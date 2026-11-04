import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  formatBrazilPhoneInput,
  isValidBrazilPhone,
  isValidEmail,
  isValidFullName,
} from '../../domain/customerFields'
import {
  createCustomer,
  listCustomers,
  listReservationsForCustomerPhone,
  setCustomerActive,
  updateCustomer,
} from '../../services/admin'
import type { Customer, Reservation } from '../../types/database'

type Props = {
  organizationId: string
  onError: (msg: string) => void
}

function localeFromLang(lang: string): string {
  return lang.startsWith('en') ? 'en-US' : 'pt-BR'
}

export function ClientsPanel({ organizationId, onError }: Props) {
  const { t, i18n } = useTranslation()
  const formRef = useRef<HTMLFormElement>(null)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [history, setHistory] = useState<Reservation[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const isEditing = Boolean(editingId)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    onError('')
    void listCustomers(organizationId, { includeInactive: showInactive })
      .then((rows) => {
        if (!cancelled) setCustomers(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          onError(
            err instanceof Error ? err.message : t('admin.clients.loadError'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, showInactive, onError, t])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    const digits = q.replace(/\D/g, '')
    return customers.filter((c) => {
      const hay = `${c.full_name} ${c.email} ${c.phone}`.toLowerCase()
      if (hay.includes(q)) return true
      if (digits.length >= 3) {
        return c.phone.replace(/\D/g, '').includes(digits)
      }
      return false
    })
  }, [customers, query])

  const selected = useMemo(
    () => customers.find((c) => c.id === selectedId) ?? null,
    [customers, selectedId],
  )

  useEffect(() => {
    if (!selected) {
      setHistory([])
      return
    }
    let cancelled = false
    setHistoryLoading(true)
    void listReservationsForCustomerPhone(organizationId, selected.phone)
      .then((rows) => {
        if (!cancelled) setHistory(rows)
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, selected])

  function resetForm() {
    setEditingId(null)
    setFullName('')
    setPhone('')
    setEmail('')
    setNotes('')
  }

  function startEdit(customer: Customer) {
    onError('')
    setEditingId(customer.id)
    setSelectedId(customer.id)
    setFullName(customer.full_name)
    setPhone(customer.phone)
    setEmail(customer.email)
    setNotes(customer.notes ?? '')
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    onError('')

    if (!isValidFullName(fullName)) {
      onError(t('reserve.nameInvalid'))
      return
    }
    if (!isValidBrazilPhone(phone)) {
      onError(t('reserve.phoneInvalid'))
      return
    }
    if (!isValidEmail(email)) {
      onError(t('reserve.emailInvalid'))
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        const updated = await updateCustomer({
          id: editingId,
          full_name: fullName,
          phone,
          email,
          notes,
        })
        setCustomers((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        )
        setSelectedId(updated.id)
      } else {
        const created = await createCustomer({
          organization_id: organizationId,
          full_name: fullName,
          phone,
          email,
          notes,
        })
        setCustomers((prev) =>
          [...prev, created].sort((a, b) =>
            a.full_name.localeCompare(b.full_name, 'pt'),
          ),
        )
        setSelectedId(created.id)
      }
      resetForm()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (/customers_org_phone_digits_uidx|duplicate|unique/i.test(msg)) {
        onError(t('admin.clients.duplicatePhone'))
      } else {
        onError(msg || t('admin.clients.saveError'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function onToggleActive(customer: Customer) {
    setBusyId(customer.id)
    onError('')
    try {
      const updated = await setCustomerActive({
        id: customer.id,
        active: !customer.active,
      })
      if (!showInactive && !updated.active) {
        setCustomers((prev) => prev.filter((c) => c.id !== updated.id))
        if (selectedId === updated.id) setSelectedId(null)
        if (editingId === updated.id) resetForm()
      } else {
        setCustomers((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        )
      }
    } catch (err) {
      onError(
        err instanceof Error ? err.message : t('admin.clients.toggleError'),
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="admin-clients">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className={`admin-clients__form rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5${isEditing ? ' is-editing' : ''}`}
      >
        <h2 className="mb-1 font-semibold text-primary">
          {isEditing
            ? t('admin.clients.editTitle')
            : t('admin.clients.createTitle')}
        </h2>
        <p className="mb-4 text-sm text-text-secondary-light">
          {isEditing
            ? t('admin.clients.editLead')
            : t('admin.clients.createLead')}
        </p>

        <div className="admin-clients__grid">
          <label className="admin-clients__field">
            <span>{t('reserve.name')}</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </label>

          <label className="admin-clients__field">
            <span>{t('reserve.phone')}</span>
            <input
              value={phone}
              onChange={(e) => setPhone(formatBrazilPhoneInput(e.target.value))}
              placeholder={t('reserve.phonePlaceholder')}
              required
              inputMode="tel"
              autoComplete="tel"
            />
          </label>

          <label className="admin-clients__field">
            <span>{t('reserve.email')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label className="admin-clients__field admin-clients__field--full">
            <span>{t('admin.clients.notes')}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t('admin.clients.notesPlaceholder')}
            />
          </label>
        </div>

        <div className="admin-clients__form-actions">
          {isEditing ? (
            <button
              type="button"
              className="admin-clients__btn is-ghost"
              onClick={resetForm}
              disabled={saving}
            >
              {t('admin.clients.cancelEdit')}
            </button>
          ) : null}
          <button
            type="submit"
            className="admin-clients__btn is-primary"
            disabled={saving}
          >
            {saving
              ? t('admin.clients.saving')
              : isEditing
                ? t('admin.clients.saveChanges')
                : t('admin.clients.saveCreate')}
          </button>
        </div>
      </form>

      <div className="admin-clients__list-panel rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
        <div className="admin-clients__toolbar">
          <div className="min-w-0">
            <h2 className="font-semibold text-primary">
              {t('admin.clients.listTitle')}
            </h2>
            <p className="text-sm text-text-secondary-light">
              {t('admin.clients.listLead', { count: filtered.length })}
            </p>
          </div>
          <label className="admin-clients__switch">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span>{t('admin.clients.showInactive')}</span>
          </label>
        </div>

        <label className="admin-clients__search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('admin.clients.searchPlaceholder')}
            aria-label={t('admin.clients.search')}
          />
        </label>

        {loading ? (
          <p className="mt-4 text-sm text-text-secondary-light">…</p>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <p className="mt-4 text-sm text-text-secondary-light">
            {t('admin.clients.listEmpty')}
          </p>
        ) : null}

        <ul className="admin-clients__list">
          {filtered.map((customer) => {
            const isSelected = selectedId === customer.id
            const isBusy = busyId === customer.id
            return (
              <li
                key={customer.id}
                className={`admin-clients__card${isSelected ? ' is-selected' : ''}${!customer.active ? ' is-inactive' : ''}${editingId === customer.id ? ' is-editing' : ''}`}
              >
                <button
                  type="button"
                  className="admin-clients__card-main"
                  onClick={() => setSelectedId(customer.id)}
                >
                  <strong>{customer.full_name}</strong>
                  <span>
                    {customer.phone} · {customer.email}
                  </span>
                  {!customer.active ? (
                    <em className="admin-clients__badge">{t('admin.clients.inactive')}</em>
                  ) : null}
                </button>
                <div className="admin-clients__card-actions">
                  <button
                    type="button"
                    className="admin-clients__btn is-ghost"
                    onClick={() => startEdit(customer)}
                  >
                    {t('admin.clients.edit')}
                  </button>
                  <button
                    type="button"
                    className="admin-clients__btn is-ghost"
                    disabled={isBusy}
                    onClick={() => void onToggleActive(customer)}
                  >
                    {customer.active
                      ? t('admin.clients.deactivate')
                      : t('admin.clients.activate')}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {selected ? (
        <div className="admin-clients__detail rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
          <h2 className="mb-1 font-semibold text-primary">
            {t('admin.clients.detailTitle')}
          </h2>
          <p className="mb-3 text-sm text-text-secondary-light">
            {selected.full_name}
          </p>
          <dl className="admin-clients__meta">
            <div>
              <dt>{t('reserve.phone')}</dt>
              <dd>{selected.phone}</dd>
            </div>
            <div>
              <dt>{t('reserve.email')}</dt>
              <dd>{selected.email}</dd>
            </div>
            {selected.notes ? (
              <div className="admin-clients__meta--full">
                <dt>{t('admin.clients.notes')}</dt>
                <dd>{selected.notes}</dd>
              </div>
            ) : null}
          </dl>

          <h3 className="mt-5 mb-2 text-sm font-semibold text-primary">
            {t('admin.clients.historyTitle')}
          </h3>
          {historyLoading ? (
            <p className="text-sm text-text-secondary-light">…</p>
          ) : null}
          {!historyLoading && history.length === 0 ? (
            <p className="text-sm text-text-secondary-light">
              {t('admin.clients.historyEmpty')}
            </p>
          ) : null}
          <ul className="admin-clients__history">
            {history.map((r) => (
              <li key={r.id}>
                <strong>
                  {new Date(r.slot_start).toLocaleString(
                    localeFromLang(i18n.language),
                  )}
                </strong>
                <span>
                  {t(`admin.status.${r.status}`)} ·{' '}
                  {t(`reserve.services.${r.service_type}`)}
                  {r.estimated_price != null
                    ? ` · R$ ${Number(r.estimated_price).toFixed(2)}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
