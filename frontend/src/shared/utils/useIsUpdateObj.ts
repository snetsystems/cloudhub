import {useEffect, useRef, useState} from 'react'
import uuid from 'uuid'
import _ from 'lodash'

interface Props {
  queryKey: string
  object: Object
}

export const useIsUpdateObj = ({queryKey, object}: Props) => {
  const [updateKey, setUpdateKey] = useState(uuid())
  const prevUuidRef = useRef(queryKey)
  const prevObjectRef = useRef(object)

  useEffect(() => {
    if (
      queryKey !== prevUuidRef.current ||
      !_.isEqual(object, prevObjectRef.current)
    ) {
      setUpdateKey(uuid())
      prevUuidRef.current = queryKey
      prevObjectRef.current = object
    }
  }, [queryKey, object])

  return updateKey
}
