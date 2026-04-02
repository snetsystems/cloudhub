import {ServerListQuery} from 'src/hosts/constants/serverListColumns'

/**
 * URL Monitoring (리스트뷰용) InfluxQL — 메인 테이블 데이터는 여기서 정의합니다.
 * 행별 RefreshingGraph용은 `utils/urlMonitoringLineQuery.ts` 의 `buildUrlMonitoringLatencyQuery` 입니다.
 *
 * - response_time: 밀리초(ms)
 * - http_response_code: 상태 코드
 *
 * 참고: 아래 쿼리는 태그 조합(host, method, server) 기준으로 series가 나뉘며,
 * 화면의 1 row는 (host, method, server) 조합에 해당하도록 merge 로직에서 처리합니다.
 */
export const urlMonitoringQueries: ServerListQuery[] = [
  {
    // 상태코드는 "현재값" 배지용으로 last()를 사용합니다.
    id: 'url-monitoring-last-status',
    text: `SELECT last("http_response_code") AS "last_http_response_code"
FROM ":db:".":rp:"."http_response"
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
GROUP BY "host", "method", "server"
FILL(null)`,
  },
  {
    // 차트는 경과 시간에 따라 여러 포인트가 필요하므로, time(:interval:)로 시계열을 만듭니다.
    id: 'url-monitoring-line-response-time',
    text: `SELECT mean("response_time")*1000 AS "response_time_ms"
FROM ":db:".":rp:"."http_response"
WHERE time > :dashboardTime: AND time < :upperDashboardTime:
GROUP BY "host", "method", "server", time(:interval:)
FILL(null)`,
  },
]

