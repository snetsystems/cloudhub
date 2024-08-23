import {useEffect, useState} from 'react'

interface Props {
  setValue: (value: any) => void
}

const useDebounce = ({setValue}: Props) => {
  const [tempVar, setTempVar] = useState<any>(null)

  useEffect(() => {
    const debounce = setTimeout(() => {
      return setValue(tempVar)
    }, 500) //->setTimeout setting
    return () => {
      clearTimeout(debounce)
    }
  }, [tempVar])

  return {tempVar, setTempVar}
}

export default useDebounce
