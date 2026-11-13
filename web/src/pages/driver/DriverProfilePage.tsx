import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  formatBrazilPhoneInput,
  isValidBrazilPhone,
  isValidFullName,
} from '../../domain/customerFields'
import {
  DRIVER_SKILL_OPTIONS,
  WEEK_DAYS,
  emptyAvailability,
} from '../../domain/drivers'
import {
  brandsForBody,
  FLEET_COLORS,
  VEHICLE_BODY_TYPES,
  fleetYearOptions,
  modelsForBrand,
  STANDARD_VEHICLE_CATEGORIES,
  type VehicleBodyType,
} from '../../domain/fleet'
import { listVehicleCategoriesAdmin } from '../../services/admin'
import {
  removeDriverVehiclePhotoByUrl,
  updateMyDriverProfile,
  uploadDriverVehiclePhoto,
} from '../../services/coreV2'
import type {
  DriverAvailabilitySlot,
  VehicleCategory,
} from '../../types/database'
import { useTenant } from '../../context/TenantContext'
import {
  IconRouteMark,
  driverInitials,
  useDriverApp,
} from './driverShared'

const YEAR_OPTIONS = fleetYearOptions()
const MAX_PHOTOS = 4
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

function brandLabel(brand: string): string {
  if (brand === 'LandRover') return 'Land Rover'
  if (brand === 'CaoaChery') return 'Caoa Chery'
  if (brand === 'Citroen') return 'Citroën'
  if (brand === 'Mini') return 'MINI'
  return brand
}

type LocalPhoto = {
  id: string
  url: string
  file?: File
  pending?: boolean
}

export function DriverProfilePage() {
  const { t, i18n } = useTranslation()
  const tenant = useTenant()
  const { driver, loading, error, setError, refresh } = useDriverApp()
  const lang = i18n.language.startsWith('en') ? 'en' : 'pt'

  const [categories, setCategories] = useState<VehicleCategory[]>([])
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [plate, setPlate] = useState('')
  const [bodyType, setBodyType] = useState<VehicleBodyType>('sedan')
  const [skills, setSkills] = useState<string[]>([])
  const [availability, setAvailability] = useState<DriverAvailabilitySlot[]>(
    emptyAvailability(),
  )
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const orgId = tenant.organizationId
  const brandOptions = useMemo(() => brandsForBody(bodyType), [bodyType])
  const modelOptions = useMemo(
    () => modelsForBrand(brand, bodyType),
    [brand, bodyType],
  )
  const activeCategories = useMemo(
    () => categories.filter((c) => c.active),
    [categories],
  )
  const categoryById = useMemo(() => {
    const map = new Map<string, VehicleCategory>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])

  useEffect(() => {
    if (!orgId) return
    void listVehicleCategoriesAdmin(orgId)
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [orgId])

  useEffect(() => {
    if (!driver) return
    setFullName(driver.full_name)
    setPhone(driver.phone)
    setCategoryId(driver.vehicle_category_id ?? '')
    setBrand(driver.vehicle_brand)
    setModel(driver.vehicle_model)
    setYear(driver.vehicle_year ? String(driver.vehicle_year) : '')
    setColor(driver.vehicle_color)
    setPlate(driver.vehicle_plate ?? '')
    setBodyType(driver.vehicle_body_type ?? 'sedan')
    setSkills(driver.skills?.length ? [...driver.skills] : [])
    setAvailability(
      driver.availability?.length
        ? driver.availability.map((s) => ({ ...s }))
        : emptyAvailability(),
    )
    setPhotos(
      (driver.vehicle_photo_urls ?? []).map((url, i) => ({
        id: `existing-${i}-${url}`,
        url,
      })),
    )
    setSaved(false)
  }, [driver])

  function toggleSkill(skill: string) {
    setSkills((prev) =>
      prev.includes(skill)
        ? prev.filter((s) => s !== skill)
        : [...prev, skill],
    )
  }

  function onAddPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return

    const room = MAX_PHOTOS - photos.length
    if (room <= 0) {
      setError(t('driver.photosMax'))
      return
    }

    const next: LocalPhoto[] = []
    for (const file of files.slice(0, room)) {
      if (file.size > MAX_PHOTO_BYTES) {
        setError(t('driver.photoTooLarge'))
        continue
      }
      if (!file.type.startsWith('image/')) {
        setError(t('driver.photoInvalid'))
        continue
      }
      next.push({
        id: `local-${crypto.randomUUID()}`,
        url: URL.createObjectURL(file),
        file,
        pending: true,
      })
    }
    if (next.length) {
      setError(null)
      setPhotos((prev) => [...prev, ...next].slice(0, MAX_PHOTOS))
    }
  }

  async function removePhoto(photo: LocalPhoto) {
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    if (photo.pending && photo.url.startsWith('blob:')) {
      URL.revokeObjectURL(photo.url)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!driver || !orgId) return
    setSaved(false)
    setError(null)

    if (!isValidFullName(fullName)) {
      setError(t('driver.validationName'))
      return
    }
    if (!isValidBrazilPhone(phone)) {
      setError(t('driver.validationPhone'))
      return
    }
    if (!categoryId) {
      setError(t('admin.drivers.categoryRequired'))
      return
    }
    if (!brand || !model || !year || !color) {
      setError(t('admin.drivers.vehicleRequired'))
      return
    }
    if (!skills.length) {
      setError(t('admin.drivers.skillsRequired'))
      return
    }
    if (!availability.length) {
      setError(t('admin.drivers.availabilityRequired'))
      return
    }

    setSaving(true)
    try {
      const uploadedUrls: string[] = []
      for (const photo of photos) {
        if (photo.file) {
          const url = await uploadDriverVehiclePhoto({
            organization_id: orgId,
            driver_id: driver.id,
            file: photo.file,
          })
          uploadedUrls.push(url)
          if (photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url)
        } else {
          uploadedUrls.push(photo.url)
        }
      }

      const kept = new Set(uploadedUrls)
      const previous = driver.vehicle_photo_urls ?? []
      for (const oldUrl of previous) {
        if (!kept.has(oldUrl)) {
          try {
            await removeDriverVehiclePhotoByUrl(oldUrl)
          } catch {
            /* ignore orphan cleanup failures */
          }
        }
      }

      await updateMyDriverProfile({
        organization_id: orgId,
        full_name: fullName,
        phone,
        vehicle_category_id: categoryId,
        vehicle_brand: brand,
        vehicle_model: model,
        vehicle_year: Number(year),
        vehicle_color: color,
        vehicle_plate: plate || null,
        vehicle_body_type: bodyType,
        skills,
        availability,
        vehicle_photo_urls: uploadedUrls.slice(0, MAX_PHOTOS),
      })
      await refresh()
      setSaved(true)
    } catch (err) {
      const msg =
        err instanceof Error && err.message === 'PHOTO_TOO_LARGE'
          ? t('driver.photoTooLarge')
          : err instanceof Error
            ? err.message
            : t('driver.saveError')
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="driver-app__loading">…</p>
  }

  if (!driver) {
    return (
      <div className="driver-app__empty">
        <div className="driver-app__empty-mark">
          <IconRouteMark />
        </div>
        <h2>{t('driver.notLinkedTitle')}</h2>
        <p>{t('driver.notLinkedLead')}</p>
      </div>
    )
  }

  return (
    <form className="driver-profile driver-profile--edit" onSubmit={onSubmit}>
      <div className="driver-profile__hero">
        <div className="driver-profile__avatar" aria-hidden="true">
          {driverInitials(fullName || driver.full_name)}
        </div>
        <h1>{t('driver.profileEditTitle')}</h1>
        <p>{t('driver.profileEditLead')}</p>
      </div>

      {error ? <p className="driver-app__alert">{error}</p> : null}
      {saved ? (
        <p className="driver-app__success" role="status">
          {t('driver.profileSaved')}
        </p>
      ) : null}

      <section className="driver-profile__block">
        <h2>{t('driver.profilePersonal')}</h2>
        <div className="driver-profile__fields">
          <label className="driver-profile__field">
            <span>{t('reserve.name')}</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </label>
          <label className="driver-profile__field">
            <span>{t('reserve.phone')}</span>
            <input
              value={phone}
              onChange={(e) => setPhone(formatBrazilPhoneInput(e.target.value))}
              required
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <label className="driver-profile__field">
            <span>{t('reserve.email')}</span>
            <input value={driver.email} readOnly disabled />
          </label>
        </div>
      </section>

      <section className="driver-profile__block">
        <h2>{t('driver.profileVehicle')}</h2>
        <div className="driver-profile__fields">
          <label className="driver-profile__field">
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
          <label className="driver-profile__field">
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
          <label className="driver-profile__field">
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
          <label className="driver-profile__field">
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
          <label className="driver-profile__field">
            <span>{t('admin.drivers.year')}</span>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
            >
              <option value="">{t('admin.fleet.yearPlaceholder')}</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="driver-profile__field">
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
          <label className="driver-profile__field">
            <span>{t('admin.drivers.plate')}</span>
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              maxLength={10}
            />
          </label>
        </div>

        <div className="driver-profile__photos">
          <div className="driver-profile__photos-head">
            <h3>{t('driver.photosTitle')}</h3>
            <p>{t('driver.photosLead', { max: MAX_PHOTOS })}</p>
          </div>
          <ul className="driver-profile__photo-grid">
            {photos.map((photo) => (
              <li key={photo.id} className="driver-profile__photo">
                <img src={photo.url} alt="" />
                <button
                  type="button"
                  className="driver-profile__photo-remove"
                  onClick={() => void removePhoto(photo)}
                  aria-label={t('driver.photoRemove')}
                >
                  ×
                </button>
              </li>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <li className="driver-profile__photo is-add">
                <label>
                  <span>{t('driver.photoAdd')}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={onAddPhotos}
                  />
                </label>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="driver-profile__block">
        <h2>{t('admin.drivers.skills')}</h2>
        <div className="driver-profile__checks">
          {DRIVER_SKILL_OPTIONS.map((skill) => (
            <label key={skill} className="driver-profile__check">
              <input
                type="checkbox"
                checked={skills.includes(skill)}
                onChange={() => toggleSkill(skill)}
              />
              <span>{t(`admin.drivers.skill.${skill}`)}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="driver-profile__block">
        <h2>{t('admin.drivers.availability')}</h2>
        <ul className="driver-profile__avail-edit">
          {availability.map((slot, index) => (
            <li key={`${slot.day_of_week}-${index}`}>
              <select
                value={slot.day_of_week}
                onChange={(e) => {
                  const day = Number(e.target.value)
                  setAvailability((prev) =>
                    prev.map((s, i) =>
                      i === index ? { ...s, day_of_week: day } : s,
                    ),
                  )
                }}
              >
                {WEEK_DAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {t(d.labelKey)}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={slot.start_time}
                onChange={(e) => {
                  const start_time = e.target.value
                  setAvailability((prev) =>
                    prev.map((s, i) =>
                      i === index ? { ...s, start_time } : s,
                    ),
                  )
                }}
              />
              <input
                type="time"
                value={slot.end_time}
                onChange={(e) => {
                  const end_time = e.target.value
                  setAvailability((prev) =>
                    prev.map((s, i) =>
                      i === index ? { ...s, end_time } : s,
                    ),
                  )
                }}
              />
              <button
                type="button"
                className="driver-app__btn is-ghost"
                disabled={availability.length <= 1}
                onClick={() =>
                  setAvailability((prev) =>
                    prev.filter((_, i) => i !== index),
                  )
                }
              >
                {t('driver.removeSlot')}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="driver-app__btn is-ghost"
          onClick={() =>
            setAvailability((prev) => [
              ...prev,
              { day_of_week: 1, start_time: '08:00', end_time: '18:00' },
            ])
          }
        >
          {t('admin.drivers.addAvailability')}
        </button>
      </section>

      <div className="driver-profile__save">
        <button
          type="submit"
          className="driver-app__btn is-primary"
          disabled={saving}
        >
          {saving ? t('driver.saving') : t('driver.saveProfile')}
        </button>
      </div>
    </form>
  )
}
