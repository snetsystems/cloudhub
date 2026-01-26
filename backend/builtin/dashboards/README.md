# Builtin Dashboards

이 디렉토리는 시스템 내장(builtin) 대시보드 정의를 포함합니다. 이 대시보드들은 Organization 생성 시 자동으로 삽입됩니다.

## 구조

각 builtin dashboard JSON 파일은 다음 구조를 가집니다:

- **id**: Dashboard ID (0으로 설정, 실제 저장 시 자동 생성됨)
- **name**: Dashboard 이름 (예: "host_page", 스네이크 케이스 사용)
- **type**: "builtin" (시스템 내장 대시보드임을 나타냄)
- **organization**: 빈 문자열 (저장 시 Organization ID로 설정됨)
- **cells**: Dashboard 셀 배열
  - 각 셀은 `DashboardCell` 구조를 따름
  - 쿼리, 시각화 설정, 레이아웃 정보 포함
- **templates**: Template 변수 배열 (선택사항)

## 사용 목적

- **host_page**: Infrastructure 페이지의 Host 상세 페이지에서 사용
- **AWS Tab**: AWS 클라우드 탭에서 사용
- **GCP Tab**: GCP 클라우드 탭에서 사용
- 기타 시스템 페이지에서 사용되는 대시보드

## 컴포넌트 타입

Builtin 대시보드는 일반 그래프 셀 외에도 커스텀 컴포넌트를 셀로 사용할 수 있습니다.

### host-table

호스트 목록을 표시하는 테이블 컴포넌트입니다.

**셀 정의 예시:**
```json
{
  "i": "host-table-cell",
  "type": "host-table",
  "x": 0,
  "y": 0,
  "w": 24,
  "h": 10,
  "minW": 12,
  "minH": 8,
  "name": "Host List",
  "queries": [],
  "axes": {
    "x": {
      "bounds": ["", ""],
      "label": "",
      "prefix": "",
      "suffix": "",
      "base": "raw",
      "scale": "linear"
    },
    "y": {
      "bounds": ["", ""],
      "label": "",
      "prefix": "",
      "suffix": "",
      "base": "raw",
      "scale": "linear"
    }
  },
  "colors": [],
  "legend": {
    "type": "static",
    "orientation": "bottom"
  },
  "tableOptions": {
    "verticalTimeAxis": false,
    "sortBy": {
      "internalName": "",
      "displayName": "",
      "visible": true,
      "direction": "asc",
      "tempVar": ""
    },
    "wrapping": "truncate",
    "fixFirstColumn": false
  },
  "fieldOptions": [],
  "timeFormat": "",
  "decimalPlaces": {
    "isEnforced": false,
    "digits": 2
  },
  "note": "",
  "noteVisibility": "default",
  "graphOptions": {
    "fillArea": false,
    "showLine": true,
    "showPoint": false,
    "showTempVarCount": ""
  },
  "tableGaugeChartOptions": {
    "columnSettings": [],
    "decimalPlaces": {
      "isEnforced": false,
      "digits": 0
    },
    "isShowValues": false,
    "sortBy": "",
    "sortByDirection": ""
  },
  "inView": true,
  "links": {}
}
```

**특징:**
- `type` 필드를 `"host-table"`로 설정
- `queries` 배열은 비어있어도 됨 (컴포넌트가 자체적으로 데이터를 가져옴)
- 권장 크기: `w: 12-24, h: 8-12`
- `LayoutRenderer`에 `hostsObject`, `hostPageStatus`, `onClickTableRow`, `tableTitle` props를 전달해야 정상 작동

**하위 호환성:**
- `cell.i === 'host-table-cell'`인 경우에도 자동으로 인식 (셀 ID 기반)

## 주의사항

- `id` 필드는 0으로 설정하거나 생략 가능 (저장 시 자동 생성)
- `organization` 필드는 빈 문자열로 설정 (저장 시 Organization ID로 설정됨)
- `type` 필드는 반드시 "builtin"으로 설정
- 셀의 쿼리에서 `:host:` 같은 template variable을 사용할 수 있음
- 커스텀 컴포넌트 셀의 경우 `LayoutRenderer`에 필요한 props를 전달해야 함
