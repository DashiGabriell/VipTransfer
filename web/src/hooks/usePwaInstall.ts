import { useCallback, useEffect, useState } from 'react'
import {
  getPwaInstallState,
  isIosDevice,
  promptPwaInstall,
  subscribePwaInstall,
} from '../lib/pwaInstall'

export function usePwaInstall() {
  const [snapshot, setSnapshot] = useState(() => getPwaInstallState())
  const [ios] = useState(() => isIosDevice())

  useEffect(() => subscribePwaInstall(setSnapshot), [])

  const promptInstall = useCallback(async () => {
    const outcome = await promptPwaInstall()
    return outcome === 'accepted'
  }, [])

  const showInstallUi = !snapshot.standalone && !snapshot.installed

  return {
    showInstallUi,
    canNativePrompt: Boolean(snapshot.deferred),
    promptInstall,
    standalone: snapshot.standalone,
    ios,
  }
}
