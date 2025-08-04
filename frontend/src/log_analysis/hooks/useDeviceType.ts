import {useEffect, useState} from 'react'
import {getTagValuesForLayoutWhereTagKeys, getLayouts} from 'src/hosts/apis'
import {generateForHosts} from 'src/utils/tempVars'
import {getDeep} from 'src/utils/wrappers'
import {DropdownItem, Source, Layout} from 'src/types'

export const useDeviceType = (source: Source) => {
  const [allTagValues, setAllTagValues] = useState<DropdownItem[]>([])

  useEffect(() => {
    const fetchDropdownItems = async () => {
      if (!source) {
        return
      }

      try {
        const layoutResults = await getLayouts()
        const layouts = getDeep<Layout[]>(layoutResults, 'data.layouts', [])

        if (layouts.length === 0) {
          setAllTagValues([])
          return
        }

        const tempVars = generateForHosts(source)
        const tagValues = await getTagValuesForLayoutWhereTagKeys(
          source,
          layouts,
          tempVars
        )
        console.log('tagValues', tagValues)
        setAllTagValues(tagValues)
      } catch (error) {
        console.error('Error fetching dropdown items:', error)
        setAllTagValues([])
      }
    }

    fetchDropdownItems()
  }, [source])

  return allTagValues
}
