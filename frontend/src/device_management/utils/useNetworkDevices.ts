import {useEffect, useState} from 'react'

import {getDeviceList} from 'src/device_management/apis'
import {DeviceData} from 'src/types'

/** Registered network devices by id, for the name, IP and location columns. */
export const useNetworkDevices = (): Record<string, DeviceData> => {
  const [devices, setDevices] = useState<Record<string, DeviceData>>({})

  useEffect(() => {
    let isCancelled = false

    getDeviceList()
      .then(res => {
        if (isCancelled) {
          return
        }
        const byID: Record<string, DeviceData> = {}
        ;(res?.data?.devices ?? []).forEach((d: DeviceData) => {
          if (d.id) {
            byID[d.id] = d
          }
        })
        setDevices(byID)
      })
      .catch(() => {
        // Device metadata is decoration; the polled data still renders without it.
      })

    return () => {
      isCancelled = true
    }
  }, [])

  return devices
}
