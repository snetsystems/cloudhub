// Libraries
import {useState, useEffect, useRef} from 'react'
import _ from 'lodash'
import uuid from 'uuid'

// Types
import {StatisticalGraphFieldOption} from 'src/types/statisticalgraph'
import {TableOptions} from 'src/types/dashboards'
import {ColorString} from 'src/types/colors'

interface Props {
  queryKey: string
  tableOptions?: TableOptions
  fieldOptions?: StatisticalGraphFieldOption[]
  colors: ColorString[]
}

export const useIsUpdated = ({
  queryKey,
  tableOptions,
  fieldOptions,
  colors,
}: Props) => {
  const [updateKey, setUpdateKey] = useState(uuid())
  const prevUuidRef = useRef(queryKey)
  const prevTableOptionsRef = useRef(tableOptions)
  const prevFieldOptionsRef = useRef(fieldOptions)
  const prevColorsRef = useRef(colors)

  useEffect(() => {
    if (
      queryKey !== prevUuidRef.current ||
      !_.isEqual(tableOptions, prevTableOptionsRef.current) ||
      !_.isEqual(fieldOptions, prevFieldOptionsRef.current) ||
      !_.isEqual(colors, prevColorsRef.current)
    ) {
      setUpdateKey(uuid())

      prevUuidRef.current = queryKey
      prevTableOptionsRef.current = tableOptions
      prevFieldOptionsRef.current = fieldOptions
      prevColorsRef.current = colors
    }
  }, [queryKey, tableOptions, fieldOptions, colors])

  return updateKey
}
