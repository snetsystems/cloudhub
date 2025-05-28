// useWordCloudLayout.ts
import {useEffect, useState} from 'react'
import {
  WordDatum,
  CloudWord,
  generateWordCloudLayout,
  Orientation,
  ScaleType,
} from '../utils/wordCloudLayout'

interface UseLayoutParams {
  data: WordDatum[]
  width: number
  height: number
  topN?: number
  orientation?: Orientation
  scale?: ScaleType
  minFontSize?: number
  maxFontSize?: number
  padding?: number
}

export function useWordCloudLayout({
  data,
  width,
  height,
  topN = 100,
  orientation = 'single',
  scale = 'linear',
  minFontSize = 10,
  maxFontSize = 36,
  padding = 5,
}: UseLayoutParams): CloudWord[] {
  const [words, setWords] = useState<CloudWord[]>([])

  useEffect(() => {
    if (!width || !height || !data.length) {
      setWords([])
      return
    }
    generateWordCloudLayout(data, {
      width,
      height,
      topN,
      orientation,
      scale,
      minFontSize,
      maxFontSize,
      padding,
    }).then(setWords)
  }, [
    data,
    width,
    height,
    topN,
    orientation,
    scale,
    minFontSize,
    maxFontSize,
    padding,
  ])

  return words
}
