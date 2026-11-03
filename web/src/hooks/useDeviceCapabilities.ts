import { useCallback, useEffect, useState } from 'react'
import {
  getCurrentPosition,
  getGeolocationPermission,
  isGeolocationSupported,
  type GeoPermissionState,
  type GeoPosition,
} from '../lib/geolocation'
import {
  getNotificationPermission,
  isNotificationSupported,
  isPushSupported,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '../lib/notifications'
import { isStandaloneDisplay } from '../lib/pwa'

export function useDeviceCapabilities() {
  const [standalone, setStandalone] = useState(false)
  const [geoPermission, setGeoPermission] =
    useState<GeoPermissionState>('prompt')
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>('default')
  const [lastPosition, setLastPosition] = useState<GeoPosition | null>(null)

  useEffect(() => {
    setStandalone(isStandaloneDisplay())
    void getGeolocationPermission().then(setGeoPermission)
    setNotificationPermission(getNotificationPermission())
  }, [])

  const refreshPermissions = useCallback(async () => {
    setGeoPermission(await getGeolocationPermission())
    setNotificationPermission(getNotificationPermission())
    setStandalone(isStandaloneDisplay())
  }, [])

  const requestLocation = useCallback(async () => {
    const pos = await getCurrentPosition()
    setLastPosition(pos)
    setGeoPermission(await getGeolocationPermission())
    return pos
  }, [])

  const requestNotifications = useCallback(async () => {
    const next = await requestNotificationPermission()
    setNotificationPermission(next)
    return next
  }, [])

  return {
    standalone,
    geolocationSupported: isGeolocationSupported(),
    notificationsSupported: isNotificationSupported(),
    pushSupported: isPushSupported(),
    geoPermission,
    notificationPermission,
    lastPosition,
    refreshPermissions,
    requestLocation,
    requestNotifications,
  }
}
