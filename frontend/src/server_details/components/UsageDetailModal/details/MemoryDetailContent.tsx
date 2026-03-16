import React from 'react'
import {UsageDetailBlock} from '../UsageDetailBlock'
import type {UsageDetailServerContext} from '../types'

export function MemoryDetailContent({
  serverContext,
}: {
  serverContext: UsageDetailServerContext
}) {
  return (
    <div className="process-detail-modal__body">
      <div className="process-detail-modal__grid process-detail-modal__grid--top">
        <UsageDetailBlock title="메모리 사용률">추후 구현</UsageDetailBlock>
        <UsageDetailBlock title="Used">추후 구현</UsageDetailBlock>
        <UsageDetailBlock title="Available">추후 구현</UsageDetailBlock>
      </div>
      <div className="process-detail-modal__grid process-detail-modal__grid--middle">
        <UsageDetailBlock title="Cached">추후 구현</UsageDetailBlock>
        <UsageDetailBlock title="Buffers">추후 구현</UsageDetailBlock>
        <UsageDetailBlock title="Swap">추후 구현</UsageDetailBlock>
      </div>
      <div className="process-detail-modal__grid process-detail-modal__grid--bottom">
        <UsageDetailBlock title="상위 프로세스">추후 구현</UsageDetailBlock>
        <UsageDetailBlock title="메모리 타임라인">추후 구현</UsageDetailBlock>
        <UsageDetailBlock title="기타">추후 구현</UsageDetailBlock>
      </div>
    </div>
  )
}
