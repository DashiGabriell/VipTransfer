import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDeviceCapabilities } from '../../hooks/useDeviceCapabilities'
import { showLocalNotification } from '../../lib/notifications'
import { InstallAppButton } from '../InstallAppButton'

type Props = {
  onError: (msg: string) => void
}

function permissionLabel(
  t: (key: string) => string,
  state: string,
): string {
  if (state === 'granted') return t('pwa.permGranted')
  if (state === 'denied') return t('pwa.permDenied')
  if (state === 'unsupported') return t('pwa.permUnsupported')
  // PermissionState 'prompt' or NotificationPermission 'default'
  return t('pwa.permPrompt')
}

export function DevicePermissionsCard({ onError }: Props) {
  const { t } = useTranslation()
  const {
    standalone,
    geolocationSupported,
    notificationsSupported,
    geoPermission,
    notificationPermission,
    lastPosition,
    requestLocation,
    requestNotifications,
  } = useDeviceCapabilities()
  const [busyGeo, setBusyGeo] = useState(false)
  const [busyNotif, setBusyNotif] = useState(false)
  const [ok, setOk] = useState<string | null>(null)

  async function onEnableLocation() {
    setOk(null)
    setBusyGeo(true)
    try {
      const pos = await requestLocation()
      setOk(
        t('pwa.locationOk', {
          lat: pos.latitude.toFixed(5),
          lng: pos.longitude.toFixed(5),
        }),
      )
    } catch (err) {
      onError(err instanceof Error ? err.message : t('pwa.locationError'))
    } finally {
      setBusyGeo(false)
    }
  }

  async function onEnableNotifications() {
    setOk(null)
    setBusyNotif(true)
    try {
      const perm = await requestNotifications()
      if (perm !== 'granted') {
        onError(t('pwa.notifDenied'))
        return
      }
      await showLocalNotification({
        title: t('pwa.notifTestTitle'),
        body: t('pwa.notifTestBody'),
        tag: 'jmdtransfer-test',
      })
      setOk(t('pwa.notifOk'))
    } catch (err) {
      onError(err instanceof Error ? err.message : t('pwa.notifError'))
    } finally {
      setBusyNotif(false)
    }
  }

  return (
    <section className="admin-panel-enter space-y-4 rounded-2xl border border-border-light bg-surface-light p-5 lg:col-span-2">
      <div>
        <h2 className="font-semibold text-primary">{t('pwa.deviceTitle')}</h2>
        <p className="mt-1 text-sm text-text-secondary-light">
          {t('pwa.deviceLead')}
        </p>
        {standalone && (
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--admin-bronze,#b08d57)]">
            {t('pwa.runningInstalled')}
          </p>
        )}
      </div>

      <InstallAppButton variant="admin" />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border-light px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <strong className="text-sm">{t('pwa.locationTitle')}</strong>
              <p className="mt-1 text-xs text-text-secondary-light">
                {permissionLabel(t, geoPermission)}
                {!geolocationSupported ? ` · ${t('pwa.permUnsupported')}` : ''}
              </p>
              {lastPosition && (
                <p className="mt-1 text-[11px] text-text-secondary-light">
                  {lastPosition.latitude.toFixed(5)},{' '}
                  {lastPosition.longitude.toFixed(5)}
                </p>
              )}
            </div>
            <button
              type="button"
              className="rounded border border-border-light px-3 py-1.5 text-xs font-semibold uppercase tracking-wide disabled:opacity-50"
              disabled={busyGeo || !geolocationSupported || geoPermission === 'denied'}
              onClick={() => void onEnableLocation()}
            >
              {busyGeo ? '…' : t('pwa.enableLocation')}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border-light px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <strong className="text-sm">{t('pwa.notifTitle')}</strong>
              <p className="mt-1 text-xs text-text-secondary-light">
                {permissionLabel(t, notificationPermission)}
                {!notificationsSupported
                  ? ` · ${t('pwa.permUnsupported')}`
                  : ''}
              </p>
            </div>
            <button
              type="button"
              className="rounded border border-border-light px-3 py-1.5 text-xs font-semibold uppercase tracking-wide disabled:opacity-50"
              disabled={
                busyNotif ||
                !notificationsSupported ||
                notificationPermission === 'denied'
              }
              onClick={() => void onEnableNotifications()}
            >
              {busyNotif ? '…' : t('pwa.enableNotif')}
            </button>
          </div>
        </div>
      </div>

      {ok && <p className="text-sm text-emerald-700">{ok}</p>}
    </section>
  )
}
