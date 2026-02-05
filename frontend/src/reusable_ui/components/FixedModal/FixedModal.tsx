import React, {useEffect, useState} from 'react'
interface Props {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  children: React.ReactNode
  width?: string
}

function FixedModal({isOpen, setIsOpen, children, width}: Props) {
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true)
      // 다음 프레임에 visible을 켜서 슬라이드 인 트랜지션이 보이도록 함
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
      return
    }

    // 닫힐 때는 우선 visible을 끄고 슬라이드 아웃 트랜지션 실행
    setIsVisible(false)

    const timeoutId = setTimeout(() => {
      setIsMounted(false)
    }, 250)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [isOpen])

  return (
    <>
      {children}
      {isMounted && (
        <>
          <div
            className={`modal-wrapper ${
              isVisible ? 'modal-wrapper--open' : 'modal-wrapper--closing'
            }`}
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`modal-content ${
              isVisible ? 'modal-content--open' : 'modal-content--closing'
            }`}
            style={{width: width || '420px'}}
          >
            {children}
          </div>
        </>
      )}
    </>
  )
}

export default FixedModal
