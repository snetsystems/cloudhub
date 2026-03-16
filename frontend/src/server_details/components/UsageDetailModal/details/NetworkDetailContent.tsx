import React from 'react'
import {UsageDetailBlock} from '../UsageDetailBlock'
import type {UsageDetailServerContext} from '../types'

export function NetworkDetailContent({
  serverContext,
}: {
  serverContext: UsageDetailServerContext
}) {
  return (
    <div className="process-detail-modal__body">
      <div className="process-detail-modal__grid process-detail-modal__grid--top">
        <UsageDetailBlock title="상세 정보">
          네트워크 상세 내용은 추후 구현 예정입니다.
        </UsageDetailBlock>
      </div>
    </div>
  )
}
