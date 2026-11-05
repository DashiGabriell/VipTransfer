import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  formatBrazilPhoneInput,
  isValidBrazilPhone,
  isValidEmail,
  isValidFullName,
} from '../domain/customerFields'
import { useTenant } from '../context/TenantContext'
import { createLead } from '../services/coreV2'

/** Additive client capture — does NOT replace ReservationForm. */
export function LeadCaptureForm() {
  const { t } = useTranslation()
  const tenant = useTenant()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)

    if (!tenant.organizationId) {
      setError(t('lead.orgMissing'))
      return
    }
    if (!isValidFullName(fullName)) {
      setError(t('reserve.nameInvalid'))
      return
    }
    if (!isValidBrazilPhone(phone)) {
      setError(t('reserve.phoneInvalid'))
      return
    }
    if (!isValidEmail(email)) {
      setError(t('reserve.emailInvalid'))
      return
    }

    setSaving(true)
    try {
      await createLead({
        organization_id: tenant.organizationId,
        full_name: fullName,
        phone,
        email,
        message,
      })
      setDone(true)
      setFullName('')
      setPhone('')
      setEmail('')
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('lead.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="lead-capture" onSubmit={onSubmit} id="captacao">
      <div className="lead-capture__head">
        <h2>{t('lead.title')}</h2>
        <p>{t('lead.lead')}</p>
      </div>

      <div className="lead-capture__grid">
        <label>
          <span>{t('reserve.name')}</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label>
          <span>{t('reserve.phone')}</span>
          <input
            value={phone}
            onChange={(e) => setPhone(formatBrazilPhoneInput(e.target.value))}
            placeholder={t('reserve.phonePlaceholder')}
            required
            inputMode="tel"
          />
        </label>
        <label>
          <span>{t('reserve.email')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="lead-capture__full">
          <span>{t('lead.message')}</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={t('lead.messagePlaceholder')}
          />
        </label>
      </div>

      {error ? <p className="lead-capture__error">{error}</p> : null}
      {done ? <p className="lead-capture__ok">{t('lead.success')}</p> : null}

      <button type="submit" disabled={saving}>
        {saving ? t('lead.sending') : t('lead.submit')}
      </button>
    </form>
  )
}
