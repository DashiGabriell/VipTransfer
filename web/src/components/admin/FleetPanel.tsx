import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  brandsForBody,
  FLEET_COLORS,
  fleetYearOptions,
  modelsForBrand,
  STANDARD_VEHICLE_CATEGORIES,
  VEHICLE_BODY_TYPES,
  type VehicleBodyType,
} from '../../domain/fleet'
import {
  createFleetVehicle,
  deleteFleetVehicle,
  fleetVehicleHasTripHistory,
  setFleetVehicleActive,
  setStandardCategoryActive,
  updateFleetVehicle,
  uploadFleetVehiclePhoto,
} from '../../services/admin'
import type { Driver, FleetVehicle, VehicleCategory } from '../../types/database'

type Props = {
  organizationId: string
  categories: VehicleCategory[]
  fleetVehicles: FleetVehicle[]
  drivers: Driver[]
  onChanged: () => void
  onError: (msg: string) => void
}

const YEAR_OPTIONS = fleetYearOptions()

function brandLabel(brand: string): string {
  if (brand === 'LandRover') return 'Land Rover'
  if (brand === 'CaoaChery') return 'Caoa Chery'
  if (brand === 'Citroen') return 'Citroën'
  if (brand === 'Mini') return 'MINI'
  return brand
}

export function FleetPanel(props: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('en') ? 'en' : 'pt'
  const formRef = useRef<HTMLFormElement>(null)

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [bodyType, setBodyType] = useState<VehicleBodyType>('sedan')
  const [plate, setPlate] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyVehicleId, setBusyVehicleId] = useState<string | null>(null)

  const brandOptions = useMemo(() => brandsForBody(bodyType), [bodyType])
  const modelOptions = useMemo(
    () => modelsForBrand(brand, bodyType),
    [brand, bodyType],
  )
  const isEditing = Boolean(editingId)
  const activeDrivers = useMemo(
    () => props.drivers.filter((d) => d.active),
    [props.drivers],
  )
  const driverById = useMemo(() => {
    const map = new Map<string, Driver>()
    for (const d of props.drivers) map.set(d.id, d)
    return map
  }, [props.drivers])

  function resetForm() {
    setEditingId(null)
    setCategoryId('')
    setDriverId('')
    setBrand('')
    setModel('')
    setYear('')
    setColor('')
    setBodyType('sedan')
    setPlate('')
    setExistingPhotoUrl(null)
    onPhotoChange(null)
  }

  function onPhotoChange(file: File | null) {
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
    setPhoto(file)
  }

  function startEdit(vehicle: FleetVehicle) {
    props.onError('')
    setEditingId(vehicle.id)
    setCategoryId(vehicle.vehicle_category_id)
    setDriverId(vehicle.driver_id ?? '')
    setBrand(vehicle.brand)
    setModel(vehicle.model)
    setYear(String(vehicle.year))
    setColor(vehicle.color)
    setBodyType(vehicle.body_type)
    setPlate(vehicle.plate ?? '')
    setExistingPhotoUrl(vehicle.photo_url)
    onPhotoChange(null)
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  async function onToggleCategory(
    code: (typeof STANDARD_VEHICLE_CATEGORIES)[number]['code'],
    next: boolean,
  ) {
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

  async function onSubmitVehicle(e: FormEvent) {
    e.preventDefault()
    props.onError('')

    const yearNum = Number(year)
    if (!categoryId) {
      props.onError(t('admin.fleet.categoryRequired'))
      return
    }
    if (!driverId) {
      props.onError(t('admin.fleet.driverRequired'))
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
      const payload = {
        vehicle_category_id: categoryId,
        driver_id: driverId,
        brand,
        model,
        year: yearNum,
        color,
        body_type: bodyType,
        plate: plate || null,
      }

      let vehicleId = editingId
      if (editingId) {
        await updateFleetVehicle({ id: editingId, ...payload })
      } else {
        const created = await createFleetVehicle({
          organization_id: props.organizationId,
          ...payload,
        })
        vehicleId = created.id
      }

      if (photo && vehicleId) {
        await uploadFleetVehiclePhoto({
          organization_id: props.organizationId,
          vehicle_id: vehicleId,
          file: photo,
        })
      }

      resetForm()
      props.onChanged()
    } catch (err) {
      props.onError(
        err instanceof Error
          ? err.message
          : t(isEditing ? 'admin.fleet.updateError' : 'admin.fleet.createError'),
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

  async function onRemoveVehicle(vehicle: FleetVehicle) {
    setBusyVehicleId(vehicle.id)
    props.onError('')
    try {
      const hasHistory = await fleetVehicleHasTripHistory(vehicle.id)
      if (hasHistory) {
        window.alert(t('admin.fleet.removeBlockedHistory'))
        if (vehicle.active) {
          await setFleetVehicleActive({ id: vehicle.id, active: false })
          props.onChanged()
        }
        return
      }
      if (!window.confirm(t('admin.fleet.removeConfirm'))) return
      await deleteFleetVehicle(vehicle.id)
      if (editingId === vehicle.id) resetForm()
      props.onChanged()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (/VEHICLE_HAS_HISTORY/i.test(msg)) {
        window.alert(t('admin.fleet.removeBlockedHistory'))
        if (vehicle.active) {
          try {
            await setFleetVehicleActive({ id: vehicle.id, active: false })
            props.onChanged()
          } catch {
            /* ignore */
          }
        }
      } else {
        props.onError(msg || t('admin.fleet.removeError'))
      }
    } finally {
      setBusyVehicleId(null)
    }
  }

  const previewSrc = photoPreview ?? existingPhotoUrl

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
        ref={formRef}
        onSubmit={onSubmitVehicle}
        className={`admin-fleet__form rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5${isEditing ? ' is-editing' : ''}`}
      >
        <h2 className="mb-1 font-semibold text-primary">
          {isEditing ? t('admin.fleet.editTitle') : t('admin.fleet.createTitle')}
        </h2>
        <p className="mb-4 text-sm text-text-secondary-light">
          {isEditing ? t('admin.fleet.editLead') : t('admin.fleet.createLead')}
        </p>

        {!activeCategories.length ? (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t('admin.fleet.enableCategoryFirst')}
          </p>
        ) : null}

        <div className="admin-fleet__grid">
          <label className="admin-fleet__field">
            <span>{t('admin.fleet.driver')}</span>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              required
              disabled={!activeDrivers.length && !isEditing}
            >
              <option value="">{t('admin.fleet.driverPlaceholder')}</option>
              {activeDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
              {isEditing &&
              driverId &&
              !activeDrivers.some((d) => d.id === driverId) &&
              driverById.get(driverId) ? (
                <option value={driverId}>
                  {driverById.get(driverId)!.full_name}
                </option>
              ) : null}
            </select>
          </label>

          <label className="admin-fleet__field">
            <span>{t('admin.fleet.category')}</span>
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
              {/* Keep current category visible while editing even if inactive */}
              {isEditing &&
              categoryId &&
              !activeCategories.some((c) => c.id === categoryId) &&
              categoryById.get(categoryId) ? (
                <option value={categoryId}>
                  {(
                    categoryById.get(categoryId)!.name_i18n as {
                      pt?: string
                      en?: string
                    }
                  )[lang] ||
                    categoryById.get(categoryId)!.name_i18n.pt ||
                    categoryById.get(categoryId)!.code}
                </option>
              ) : null}
            </select>
          </label>

          <label className="admin-fleet__field">
            <span>{t('admin.fleet.body')}</span>
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
            <span>{t('admin.fleet.brand')}</span>
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value)
                setModel('')
              }}
              required
              disabled={!activeCategories.length && !isEditing}
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

          <label className="admin-fleet__field">
            <span>{t('admin.fleet.model')}</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
              disabled={!brand || (!activeCategories.length && !isEditing)}
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

          <label className="admin-fleet__field">
            <span>{t('admin.fleet.year')}</span>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
              disabled={!activeCategories.length && !isEditing}
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
              disabled={!activeCategories.length && !isEditing}
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
            {previewSrc ? (
              <img
                src={previewSrc}
                alt=""
                className="admin-fleet__photo-preview"
              />
            ) : null}
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={saving || (!activeCategories.length && !isEditing)}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-text-primary-dark disabled:opacity-60"
          >
            {saving
              ? t('admin.fleet.saving')
              : isEditing
                ? t('admin.fleet.saveChanges')
                : t('admin.fleet.saveVehicle')}
          </button>
          {isEditing ? (
            <button
              type="button"
              disabled={saving}
              onClick={resetForm}
              className="rounded-lg border border-border-light px-4 py-2 text-sm text-text-secondary-light disabled:opacity-60"
            >
              {t('admin.fleet.cancelEdit')}
            </button>
          ) : null}
        </div>
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
            const editingThis = editingId === v.id
            return (
              <li
                key={v.id}
                className={`admin-fleet__vehicle${editingThis ? ' is-editing' : ''}`}
              >
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
                  <p className="admin-fleet__vehicle-cat">
                    {t('admin.fleet.driver')}:{' '}
                    {v.driver_id
                      ? driverById.get(v.driver_id)?.full_name ?? '—'
                      : '—'}
                  </p>
                </div>
                <div className="admin-fleet__vehicle-actions">
                  <span
                    className={`admin-fleet__badge${v.active ? ' is-on' : ''}`}
                  >
                    {editingThis
                      ? t('admin.fleet.editingBadge')
                      : v.active
                        ? t('admin.fleet.active')
                        : t('admin.fleet.inactive')}
                  </span>
                  <button
                    type="button"
                    disabled={busyVehicleId === v.id || saving}
                    onClick={() => startEdit(v)}
                    className="rounded border border-border-light px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {t('admin.fleet.edit')}
                  </button>
                  <button
                    type="button"
                    disabled={busyVehicleId === v.id || saving}
                    onClick={() => void onToggleVehicle(v)}
                    className="rounded border border-border-light px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {v.active
                      ? t('admin.fleet.deactivate')
                      : t('admin.fleet.activate')}
                  </button>
                  <button
                    type="button"
                    disabled={busyVehicleId === v.id || saving}
                    onClick={() => void onRemoveVehicle(v)}
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                  >
                    {t('admin.fleet.remove')}
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
