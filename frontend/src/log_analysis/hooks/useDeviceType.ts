import {useEffect, useState} from 'react'
import {getAllTagValuesForDeviceTypes} from 'src/hosts/apis'
import {generateForHosts} from 'src/utils/tempVars'
import {DropdownItem, Source} from 'src/types'

export const useDeviceType = (source: Source) => {
  const [allTagValues, setAllTagValues] = useState<{
    [deviceType: string]: DropdownItem[]
  }>({})

  useEffect(() => {
    const fetchData = async () => {
      const tempVars = generateForHosts(source)
      const tagValues = await getAllTagValuesForDeviceTypes(source, tempVars)
      setAllTagValues(tagValues)
    }
    fetchData()
  }, [source])

  return allTagValues
}
