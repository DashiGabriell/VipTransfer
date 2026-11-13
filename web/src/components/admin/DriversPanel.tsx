import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DRIVER_SKILL_OPTIONS,
  WEEK_DAYS,
  emptyAvailability,
} from '../../domain/drivers'
import {
  formatBrazilPhoneInput,
  isValidBrazilPhone,
  isValidEmail,
  isValidFullName,
} from '../../domain/customerFields'
import {
  brandsForBody,
  FLEET_COLORS,
  VEHICLE_BODY_TYPES,
  fleetYearOptions,
  modelsForBrand,
  STANDARD_VEHICLE_CATEGORIES,
  type VehicleBodyType,
} from '../../domain/fleet'

const YEAR_OPTIONS = fleetYearOptions()

function brandLabel(brand: string): string {
  if (brand === 'LandRover') return 'Land Rover'
  if (brand === 'CaoaChery') return 'Caoa Chery'
  if (brand === 'Citroen') return 'Citroën'
  if (brand === 'Mini') return 'MINI'
  return brand
}
import {
  createDriver,
  inviteDriver,
  listDrivers,
  setDriverActive,
  updateDriver,
} from '../../services/coreV2'
import type { Driver, DriverAvailabilitySlot, VehicleCategory } from '../../types/database'

type Props = {
  organizationId: string
  categories: VehicleCategory[]
  onError: (msg: string) => void
}

export function DriversPanel({ organizationId, categories, onError }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('en') ? 'en' : 'pt'
  const formRef = useRef<HTMLFormElement>(null)

  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [plate, setPlate] = useState('')
  const [bodyType, setBodyType] = useState<VehicleBodyType>('sedan')
  const [skills, setSkills] = useState<string[]>([])
  const [availability, setAvailability] =
    useState<DriverAvailabilitySlot[]>(emptyAvailability)
  const [notes, setNotes] = useState('')
  const [documentsNotes, setDocumentsNotes] = useState('')

  const activeCategories = useMemo(
    () => categories.filter((c) => c.active),
    [categories],
  )
  const brandOptions = useMemo(() => brandsForBody(bodyType), [bodyType])
  const modelOptions = useMemo(
    () => modelsForBrand(brand, bodyType),
    [brand, bodyType],
  )
  const categoryById = useMemo(() => {
    const map = new Map<string, VehicleCategory>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])
  const isEditing = Boolean(editingId)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    onError('')
    void listDrivers(organizationId, { includeInactive: showInactive })
      .then((rows) => {
        if (!cancelled) setDrivers(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : t('admin.drivers.loadError'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, showInactive, onError, t])

  function resetForm() {
    setEditingId(null)
    setFullName('')
    setPhone('')
    setEmail('')
    setCategoryId('')
    setBrand('')
    setModel('')
    setYear('')
    setColor('')
    setPlate('')
    setBodyType('sedan')
    setSkills([])
    setAvailability(emptyAvailability())
    setNotes('')
    setDocumentsNotes('')
    setFormOpen(false)
  }

  function openCreate() {
    onError('')
    setEditingId(null)
    setFullName('')
    setPhone('')
    setEmail('')
    setCategoryId('')
    setBrand('')
    setModel('')
    setYear('')
    setColor('')
    setPlate('')
    setBodyType('sedan')
    setSkills([])
    setAvailability(emptyAvailability())
    setNotes('')
    setDocumentsNotes('')
    setFormOpen(true)
  }

  function startEdit(driver: Driver) {
    onError('')
    setEditingId(driver.id)
    setFullName(driver.full_name)
    setPhone(driver.phone)
    setEmail(driver.email)
    setCategoryId(driver.vehicle_category_id ?? '')
    setBrand(driver.vehicle_brand)
    setModel(driver.vehicle_model)
    setYear(driver.vehicle_year ? String(driver.vehicle_year) : '')
    setColor(driver.vehicle_color)
    setPlate(driver.vehicle_plate ?? '')
    setBodyType(driver.vehicle_body_type ?? 'sedan')
    setSkills(driver.skills ?? [])
    setAvailability(
      driver.availability?.length ? driver.availability : emptyAvailability(),
    )
    setNotes(driver.notes ?? '')
    setDocumentsNotes(driver.documents_notes ?? '')
    setFormOpen(true)
  }

  function toggleSkill(skill: string) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    )
  }

  function updateSlot(
    index: number,
    patch: Partial<DriverAvailabilitySlot>,
  ) {
    setAvailability((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
    )
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
    if (!categoryId) {
      onError(t('admin.drivers.categoryRequired'))
      return
    }
    if (!brand.trim() || !model.trim() || !color.trim() || !year) {
      onError(t('admin.drivers.vehicleRequired'))
      return
    }
    if (!skills.length) {
      onError(t('admin.drivers.skillsRequired'))
      return
    }
    if (!availability.length) {
      onError(t('admin.drivers.availabilityRequired'))
      return
    }

    const yearNum = Number(year)
    setSaving(true)
    try {
      const payload = {
        full_name: fullName,
        phone,
        email,
        vehicle_category_id: categoryId,
        vehicle_brand: brand,
        vehicle_model: model,
        vehicle_year: yearNum,
        vehicle_color: color,
        vehicle_plate: plate || null,
        vehicle_body_type: bodyType,
        skills,
        availability,
        notes,
        documents_notes: documentsNotes,
      }
      if (editingId) {
        const updated = await updateDriver(editingId, payload)
        setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      } else {
        const created = await createDriver({
          organization_id: organizationId,
          ...payload,
        })
        let withInvite = created
        try {
          withInvite = await inviteDriver(created.id)
        } catch (inviteErr) {
          onError(
            inviteErr instanceof Error
              ? `${t('admin.drivers.createdInviteFailed')}: ${inviteErr.message}`
              : t('admin.drivers.createdInviteFailed'),
          )
        }
        setDrivers((prev) =>
          [...prev, withInvite].sort((a, b) =>
            a.full_name.localeCompare(b.full_name, 'pt'),
          ),
        )
      }
      resetForm()
    } catch (err) {
      onError(err instanceof Error ? err.message : t('admin.drivers.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function onInvite(driver: Driver) {
    setBusyId(driver.id)
    onError('')
    try {
      const updated = await inviteDriver(driver.id)
      setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
    } catch (err) {
      onError(
        err instanceof Error ? err.message : t('admin.drivers.inviteError'),
      )
    } finally {
      setBusyId(null)
    }
  }

  async function onToggle(driver: Driver) {
    setBusyId(driver.id)
    onError('')
    try {
      const updated = await setDriverActive(driver.id, !driver.active)
      if (!showInactive && !updated.active) {
        setDrivers((prev) => prev.filter((d) => d.id !== updated.id))
        if (editingId === updated.id) resetForm()
      } else {
        setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : t('admin.drivers.toggleError'))
    } finally {
      setBusyId(null)
    }
  }

  function categoryLabel(id: string | null) {
    if (!id) return '—'
    const cat = categories.find((c) => c.id === id)
    if (!cat) return '—'
    return (cat.name_i18n as { pt?: string; en?: string })[lang] || cat.name_i18n.pt || cat.code
  }

  return (
    <section className="admin-clients admin-clients--list-only">
      {formOpen
        ? createPortal(
            <div className="admin-form-modal" role="presentation">
              <button
                type="button"
                className="admin-form-modal__backdrop"
                aria-label={t('admin.closeModal')}
                onClick={resetForm}
              />
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className={`admin-form-modal__panel admin-clients__form${isEditing ? ' is-editing' : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <header className="admin-form-modal__head">
          <div>
            <h2>
              {isEditing ? t('admin.drivers.editTitle') : t('admin.drivers.createTitle')}
            </h2>
            <p>
              {isEditing ? t('admin.drivers.editLead') : t('admin.drivers.createLead')}
            </p>
          </div>
          <button
            type="button"
            className="admin-form-modal__close"
            onClick={resetForm}
            aria-label={t('admin.closeModal')}
          >
            ×
          </button>
        </header>

        <div className="admin-clients__grid admin-clients__grid--horizontal">
          <label className="admin-clients__field">
            <span>{t('reserve.name')}</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label className="admin-clients__field">
            <span>{t('reserve.phone')}</span>
            <input
              value={phone}
              onChange={(e) => setPhone(formatBrazilPhoneInput(e.target.value))}
              required
              inputMode="tel"
            />
          </label>
          <label className="admin-clients__field">
            <span>{t('reserve.email')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="admin-clients__field">
            <span>{t('admin.drivers.category')}</span>
            <select
              value={categoryId}
              onChange={(e) => {
                const nextCategoryId = e.target.value
                setCategoryId(nextCategoryId)
                const cat = categoryById.get(nextCategoryId)
                const def = STANDARD_VEHICLE_CATEGORIES.find(
                  (c) => c.code === cat?.code,
                )
                if (def) {
                  setBodyType(def.default_body)
                  const nextBrands = brandsForBody(def.default_body)
                  if (brand && !nextBrands.includes(brand)) {
                    setBrand('')
                    setModel('')
                  } else if (
                    model &&
                    !modelsForBrand(brand, def.default_body).includes(model)
                  ) {
                    setModel('')
                  }
                }
              }}
              required
            >
              <option value="">{t('admin.drivers.categoryPlaceholder')}</option>
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.name_i18n as { pt?: string; en?: string })[lang] ||
                    c.name_i18n.pt ||
                    c.code}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-clients__field">
            <span>{t('admin.drivers.body')}</span>
            <select
              value={bodyType}
              onChange={(e) => {
                const next = e.target.value as VehicleBodyType
                setBodyType(next)
                const nextBrands = brandsForBody(next)
                if (brand && !nextBrands.includes(brand)) {
                  setBrand('')
                  setModel('')
                } else if (
                  model &&
                  !modelsForBrand(brand, next).includes(model)
                ) {
                  setModel('')
                }
              }}
            >
              {VEHICLE_BODY_TYPES.map((b) => (
                <option key={b} value={b}>
                  {t(`admin.fleet.bodyTypes.${b}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-clients__field">
            <span>{t('admin.drivers.brand')}</span>
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value)
                setModel('')
              }}
              required
            >
              <option value="">{t('admin.fleet.brandPlaceholder')}</option>
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {brandLabel(b)}
                </option>
              ))}
              {brand && !brandOptions.includes(brand) ? (
                <option value={brand}>{brandLabel(brand)}</option>
              ) : null}
            </select>
          </label>
          <label className="admin-clients__field">
            <span>{t('admin.drivers.model')}</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
              disabled={!brand}
            >
              <option value="">
                {brand
                  ? t('admin.fleet.modelPlaceholder')
                  : t('admin.fleet.modelNeedBrand')}
              </option>
              {modelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              {model && !modelOptions.includes(model) ? (
                <option value={model}>{model}</option>
              ) : null}
            </select>
          </label>
          <label className="admin-clients__field">
            <span>{t('admin.drivers.year')}</span>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
            >
              <option value="">{t('admin.fleet.yearPlaceholder')}</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              {year && !YEAR_OPTIONS.includes(Number(year)) ? (
                <option value={year}>{year}</option>
              ) : null}
            </select>
          </label>
          <label className="admin-clients__field">
            <span>{t('admin.drivers.color')}</span>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              required
            >
              <option value="">{t('admin.fleet.colorPlaceholder')}</option>
              {FLEET_COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(c.labelKey)}
                </option>
              ))}
              {color && !FLEET_COLORS.some((c) => c.value === color) ? (
                <option value={color}>{color}</option>
              ) : null}
            </select>
          </label>
          <label className="admin-clients__field">
            <span>{t('admin.drivers.plate')}</span>
            <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} />
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold text-primary">
            {t('admin.drivers.skills')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {DRIVER_SKILL_OPTIONS.map((skill) => (
              <label key={skill} className="admin-clients__switch">
                <input
                  type="checkbox"
                  checked={skills.includes(skill)}
                  onChange={() => toggleSkill(skill)}
                />
                <span>{t(`admin.drivers.skill.${skill}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold text-primary">
            {t('admin.drivers.availability')}
          </legend>
          <div className="space-y-2">
            {availability.map((slot, index) => (
              <div key={index} className="admin-clients__grid">
                <label className="admin-clients__field">
                  <span>{t('admin.dayOfWeek')}</span>
                  <select
                    value={slot.day_of_week}
                    onChange={(e) =>
                      updateSlot(index, { day_of_week: Number(e.target.value) })
                    }
                  >
                    {WEEK_DAYS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {t(d.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-clients__field">
                  <span>{t('admin.startTime')}</span>
                  <input
                    type="time"
                    value={slot.start_time}
                    onChange={(e) => updateSlot(index, { start_time: e.target.value })}
                    required
                  />
                </label>
                <label className="admin-clients__field">
                  <span>{t('admin.endTime')}</span>
                  <input
                    type="time"
                    value={slot.end_time}
                    onChange={(e) => updateSlot(index, { end_time: e.target.value })}
                    required
                  />
                </label>
                <div className="admin-clients__field flex items-end">
                  <button
                    type="button"
                    className="admin-clients__btn is-ghost"
                    onClick={() =>
                      setAvailability((prev) => prev.filter((_, i) => i !== index))
                    }
                    disabled={availability.length <= 1}
                  >
                    {t('admin.deleteWindow')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="admin-clients__btn is-ghost mt-2"
            onClick={() =>
              setAvailability((prev) => [
                ...prev,
                { day_of_week: 1, start_time: '08:00', end_time: '18:00' },
              ])
            }
          >
            {t('admin.drivers.addAvailability')}
          </button>
        </fieldset>

        <div className="admin-clients__grid mt-4">
          <label className="admin-clients__field admin-clients__field--full">
            <span>{t('admin.drivers.notes')}</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </label>
          <label className="admin-clients__field admin-clients__field--full">
            <span>{t('admin.drivers.documents')}</span>
            <textarea
              value={documentsNotes}
              onChange={(e) => setDocumentsNotes(e.target.value)}
              rows={2}
            />
          </label>
        </div>

        <div className="admin-clients__form-actions">
          <button type="button" className="admin-clients__btn is-ghost" onClick={resetForm}>
            {t('admin.clients.cancelEdit')}
          </button>
          <button type="submit" className="admin-clients__btn is-primary" disabled={saving}>
            {saving
              ? t('admin.clients.saving')
              : isEditing
                ? t('admin.clients.saveChanges')
                : t('admin.drivers.saveCreate')}
          </button>
        </div>
      </form>
            </div>,
            document.body,
          )
        : null}

      <div className="admin-clients__list-panel rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
        <div className="admin-clients__toolbar">
          <div>
            <h2 className="font-semibold text-primary">{t('admin.drivers.listTitle')}</h2>
            <p className="text-sm text-text-secondary-light">
              {t('admin.drivers.listLead', { count: drivers.length })}
            </p>
          </div>
          <div className="admin-clients__toolbar-actions">
            <button
              type="button"
              className="admin-clients__btn is-primary"
              onClick={openCreate}
            >
              {t('admin.drivers.createTitle')}
            </button>
            <label className="admin-clients__switch">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              <span>{t('admin.clients.showInactive')}</span>
            </label>
          </div>
        </div>

        {loading ? <p className="text-sm text-text-secondary-light">…</p> : null}
        {!loading && !drivers.length ? (
          <p className="text-sm text-text-secondary-light">{t('admin.drivers.listEmpty')}</p>
        ) : null}

        <ul className="admin-clients__list">
          {drivers.map((driver) => (
            <li
              key={driver.id}
              className={`admin-clients__card${!driver.active ? ' is-inactive' : ''}${editingId === driver.id ? ' is-editing' : ''}`}
            >
              <div className="admin-clients__card-main">
                <strong>{driver.full_name}</strong>
                <span>
                  {driver.phone} · {categoryLabel(driver.vehicle_category_id)} ·{' '}
                  {driver.vehicle_brand} {driver.vehicle_model}
                </span>
                <em className="admin-clients__badge">
                  {driver.profile_complete
                    ? t('admin.drivers.ready')
                    : t('admin.drivers.incomplete')}
                  {` · ${t(`admin.drivers.inviteStatus.${driver.invite_status}`)}`}
                  {!driver.active ? ` · ${t('admin.clients.inactive')}` : ''}
                </em>
              </div>
              <div className="admin-clients__card-actions">
                <Link
                  to={`/admin/motoristas/${driver.id}`}
                  className="admin-clients__btn is-ghost"
                >
                  {t('admin.clients.details')}
                </Link>
                <button
                  type="button"
                  className="admin-clients__btn is-ghost"
                  onClick={() => startEdit(driver)}
                >
                  {t('admin.clients.edit')}
                </button>
                {driver.invite_status !== 'accepted' ? (
                  <button
                    type="button"
                    className="admin-clients__btn is-ghost"
                    disabled={busyId === driver.id}
                    onClick={() => void onInvite(driver)}
                  >
                    {driver.invite_status === 'pending'
                      ? t('admin.drivers.resendInvite')
                      : t('admin.drivers.sendInvite')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="admin-clients__btn is-ghost"
                  disabled={busyId === driver.id}
                  onClick={() => void onToggle(driver)}
                >
                  {driver.active
                    ? t('admin.clients.deactivate')
                    : t('admin.clients.activate')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
