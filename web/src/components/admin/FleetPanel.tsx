import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FLEET_BRANDS,
  FLEET_COLORS,
  fleetYearOptions,
  modelsForBrand,
  STANDARD_VEHICLE_CATEGORIES,
  VEHICLE_BODY_TYPES,
  type VehicleBodyType,
} from '../../domain/fleet'
import {
  createFleetVehicle,
  setFleetVehicleActive,
  setStandardCategoryActive,
  uploadFleetVehiclePhoto,
} from '../../services/admin'
import type { FleetVehicle, VehicleCategory } from '../../types/database'

type Props = {
  organizationId: string
  categories: VehicleCategory[]
  fleetVehicles: FleetVehicle[]
  onChanged: () => void
  onError: (msg: string) => void
}

const YEAR_OPTIONS = fleetYearOptions()

export function FleetPanel(props: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('en') ? 'en' : 'pt'

  const categoryByCode = useMemo(() => {
    const map = new Map<string, VehicleCategory>()
    for (const c of props.categories) map.set(c.code, c)
    return map
  }, [props.categories])

  const categoryById = useMemo(() => {
    const map = new Map<string, VehicleCategory>()
    for (const c of props.categories) map.set(c.id, c)
    return map
  }, [props.categories])

  const activeCategories = useMemo(
    () => props.categories.filter((c) => c.active),
    [props.categories],
  )

  const [togglingCode, setTogglingCode] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [bodyType, setBodyType] = useState<VehicleBodyType>('sedan')
  const [plate, setPlate] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyVehicleId, setBusyVehicleId] = useState<string | null>(null)

  const modelOptions = useMemo(() => modelsForBrand(brand), [brand])

  async function onToggleCategory(code: (typeof STANDARD_VEHICLE_CATEGORIES)[number]['code'], next: boolean) {
    setTogglingCode(code)
    props.onError('')
    try {
      await setStandardCategoryActive({
        organization_id: props.organizationId,
        code,
        active: next,
      })
      props.onChanged()
    } catch (err) {
      props.onError(
        err instanceof Error ? err.message : t('admin.fleet.toggleError'),
      )
    } finally {
      setTogglingCode(null)
    }
  }

  function onPhotoChange(file: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : null)
  }

  async function onCreateVehicle(e: FormEvent) {
    e.preventDefault()
    props.onError('')

    const yearNum = Number(year)
    if (!categoryId) {
      props.onError(t('admin.fleet.categoryRequired'))
      return
    }
    if (!brand || !model || !color || !year) {
      props.onError(t('admin.fleet.fieldsRequired'))
      return
    }
    if (!YEAR_OPTIONS.includes(yearNum)) {
      props.onError(t('admin.fleet.yearInvalid'))
      return
    }
    if (photo && photo.size > 5 * 1024 * 1024) {
      props.onError(t('admin.fleet.photoTooLarge'))
      return
    }

    setSaving(true)
    try {
      const created = await createFleetVehicle({
        organization_id: props.organizationId,
        vehicle_category_id: categoryId,
        brand,
        model,
        year: yearNum,
        color,
        body_type: bodyType,
        plate: plate || null,
      })

      if (photo) {
        await uploadFleetVehiclePhoto({
          organization_id: props.organizationId,
          vehicle_id: created.id,
          file: photo,
        })
      }

      setBrand('')
      setModel('')
      setYear('')
      setColor('')
      setBodyType('sedan')
      setPlate('')
      onPhotoChange(null)
      props.onChanged()
    } catch (err) {
      props.onError(
        err instanceof Error ? err.message : t('admin.fleet.createError'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function onToggleVehicle(vehicle: FleetVehicle) {
    setBusyVehicleId(vehicle.id)
    props.onError('')
    try {
      await setFleetVehicleActive({ id: vehicle.id, active: !vehicle.active })
      props.onChanged()
    } catch (err) {
      props.onError(
        err instanceof Error ? err.message : t('admin.fleet.toggleVehicleError'),
      )
    } finally {
      setBusyVehicleId(null)
    }
  }

  return (
    <section className="admin-fleet">
      <div className="admin-fleet__config rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
        <h2 className="mb-1 font-semibold text-primary">
          {t('admin.fleet.categoriesTitle')}
        </h2>
        <p className="mb-4 text-sm text-text-secondary-light">
          {t('admin.fleet.categoriesLead')}
        </p>
        <ul className="admin-fleet__category-list">
          {STANDARD_VEHICLE_CATEGORIES.map((def) => {
            const row = categoryByCode.get(def.code)
            const active = Boolean(row?.active)
            const label = lang === 'en' ? def.name_en : def.name_pt
            return (
              <li key={def.code} className="admin-fleet__category-row">
                <div className="min-w-0">
                  <strong>{label}</strong>
                  <span>
                    {def.is_armored
                      ? t('admin.fleet.armored')
                      : t('admin.fleet.notArmored')}
                  </span>
                </div>
                <label className="admin-fleet__switch">
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={togglingCode === def.code}
                    onChange={(e) => void onToggleCategory(def.code, e.target.checked)}
                  />
                  <span>{active ? t('admin.fleet.enabled') : t('admin.fleet.disabled')}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>

      <form
        onSubmit={onCreateVehicle}
        className="admin-fleet__form rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5"
      >
        <h2 className="mb-1 font-semibold text-primary">
          {t('admin.fleet.createTitle')}
        </h2>
        <p className="mb-4 text-sm text-text-secondary-light">
          {t('admin.fleet.createLead')}
        </p>

        {!activeCategories.length ? (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t('admin.fleet.enableCategoryFirst')}
          </p>
        ) : null}

        <div className="admin-fleet__grid">
          <label className="admin-fleet__field">
            <span>{t('admin.fleet.category')}</span>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                const cat = categoryById.get(e.target.value)
                const def = STANDARD_VEHICLE_CATEGORIES.find(
                  (c) => c.code === cat?.code,
                )
                if (def) setBodyType(def.default_body)
              }}
              required
              disabled={!activeCategories.length}
            >
              <option value="">{t('admin.fleet.categoryPlaceholder')}</option>
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.name_i18n as { pt?: string; en?: string })[lang] ||
                    c.name_i18n.pt ||
                    c.code}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-fleet__field">
            <span>{t('admin.fleet.brand')}</span>
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value)
                setModel('')
              }}
              required
              disabled={!activeCategories.length}
            >
              <option value="">{t('admin.fleet.brandPlaceholder')}</option>
              {FLEET_BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b === 'LandRover'
                    ? 'Land Rover'
                    : b === 'CaoaChery'
                      ? 'Caoa Chery'
                      : b}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-fleet__field">
            <span>{t('admin.fleet.model')}</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
              disabled={!brand || !activeCategories.length}
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
            </select>
          </label>

          <label className="admin-fleet__field">
            <span>{t('admin.fleet.year')}</span>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
              disabled={!activeCategories.length}
            >
              <option value="">{t('admin.fleet.yearPlaceholder')}</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-fleet__field">
            <span>{t('admin.fleet.color')}</span>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              required
              disabled={!activeCategories.length}
            >
              <option value="">{t('admin.fleet.colorPlaceholder')}</option>
              {FLEET_COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(c.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-fleet__field">
            <span>{t('admin.fleet.body')}</span>
            <select
              value={bodyType}
              onChange={(e) => setBodyType(e.target.value as VehicleBodyType)}
              required
            >
              {VEHICLE_BODY_TYPES.map((body) => (
                <option key={body} value={body}>
                  {t(`admin.fleet.bodyTypes.${body}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-fleet__field">
            <span>{t('admin.fleet.plate')}</span>
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              maxLength={10}
              placeholder="ABC1D23"
            />
          </label>

          <label className="admin-fleet__field admin-fleet__field--photo">
            <span>{t('admin.fleet.photo')}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
            />
            {photoPreview ? (
              <img
                src={photoPreview}
                alt=""
                className="admin-fleet__photo-preview"
              />
            ) : null}
          </label>
        </div>

        <button
          type="submit"
          disabled={saving || !activeCategories.length}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-text-primary-dark disabled:opacity-60"
        >
          {saving ? t('admin.fleet.saving') : t('admin.fleet.saveVehicle')}
        </button>
      </form>

      <div className="admin-fleet__list rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5 md:col-span-2">
        <h2 className="mb-3 font-semibold text-primary">
          {t('admin.fleet.listTitle')}
        </h2>
        <ul className="admin-fleet__vehicles">
          {props.fleetVehicles.map((v) => {
            const cat = categoryById.get(v.vehicle_category_id)
            const catLabel =
              (cat?.name_i18n as { pt?: string; en?: string } | undefined)?.[
                lang
              ] ||
              cat?.name_i18n?.pt ||
              '—'
            return (
              <li key={v.id} className="admin-fleet__vehicle">
                <div className="admin-fleet__vehicle-media">
                  {v.photo_url ? (
                    <img src={v.photo_url} alt="" />
                  ) : (
                    <span className="admin-fleet__vehicle-placeholder" aria-hidden="true" />
                  )}
                </div>
                <div className="admin-fleet__vehicle-body min-w-0">
                  <strong>
                    {v.brand} {v.model} · {v.year}
                  </strong>
                  <p>
                    {v.color} · {t(`admin.fleet.bodyTypes.${v.body_type}`)}
                    {v.plate ? ` · ${v.plate}` : ''}
                  </p>
                  <p className="admin-fleet__vehicle-cat">{catLabel}</p>
                </div>
                <div className="admin-fleet__vehicle-actions">
                  <span
                    className={`admin-fleet__badge${v.active ? ' is-on' : ''}`}
                  >
                    {v.active
                      ? t('admin.fleet.active')
                      : t('admin.fleet.inactive')}
                  </span>
                  <button
                    type="button"
                    disabled={busyVehicleId === v.id}
                    onClick={() => void onToggleVehicle(v)}
                    className="rounded border border-border-light px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {v.active
                      ? t('admin.fleet.deactivate')
                      : t('admin.fleet.activate')}
                  </button>
                </div>
              </li>
            )
          })}
          {!props.fleetVehicles.length && (
            <li className="text-sm text-text-secondary-light">
              {t('admin.fleet.listEmpty')}
            </li>
          )}
        </ul>
      </div>
    </section>
  )
}
