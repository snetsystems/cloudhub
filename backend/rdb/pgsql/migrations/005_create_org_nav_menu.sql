-- 005_create_org_nav_menu.sql
-- 조직(Org)별 SideNav 메뉴 노출/가림 제어 RDB 정규화 스키마 (3NF)

-- 1. 메뉴 마스터 테이블 (nav_menu_items)
CREATE TABLE IF NOT EXISTS nav_menu_items (
    id          TEXT        PRIMARY KEY,
    parent_id   TEXT        REFERENCES nav_menu_items(id) ON DELETE RESTRICT,
    label       TEXT        NOT NULL,
    icon        TEXT        NULL,
    sort_order  INT         NOT NULL DEFAULT 0,
    delete_yn   BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nav_menu_items_parent_id ON nav_menu_items (parent_id) WHERE delete_yn = false;

COMMENT ON TABLE nav_menu_items IS '시스템 전체 SideNav 메뉴 마스터 테이블';

-- 2. 조직별 메뉴 권한 매핑 테이블 (org_nav_permissions)
CREATE TABLE IF NOT EXISTS org_nav_permissions (
    id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id       TEXT        NOT NULL,
    menu_item_id TEXT        NOT NULL REFERENCES nav_menu_items(id) ON DELETE CASCADE,
    enabled      BOOLEAN     NOT NULL DEFAULT true,
    delete_yn    BOOLEAN     NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_org_menu_permission UNIQUE (org_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_org_nav_permissions_org_id ON org_nav_permissions (org_id) WHERE delete_yn = false;

COMMENT ON TABLE org_nav_permissions IS 'Org별 메뉴 노출/가림 (enabled: true/false) 매핑 테이블';

-- 3. Cloudhub SideNav 11개 메인 메뉴 & 서브 메뉴 마스터 데이터 초기 삽입 (아이콘 명칭 포함)
INSERT INTO nav_menu_items (id, parent_id, label, icon, sort_order) VALUES
-- Depth 1 메인 메뉴 (Icon 지정)
('visualize', NULL, 'Visualize', 'graphline-2', 1),
('dashboards', NULL, 'Dashboards', 'dash-j', 2),
('network-monitoring', NULL, 'Network Monitoring', 'network', 3),
('server-monitoring', NULL, 'Server Monitoring', 'server2', 4),
('url-monitoring', NULL, 'URL Monitoring', 'sphere', 5),
('db-monitoring', NULL, 'DB Monitoring', 'disks', 6),
('app-performance-monitoring', NULL, 'App. Performance Monitoring', 'tachometer', 7),
('kubernetes', NULL, 'Kubernetes', 'kubernetes', 8),
('log-viewer', NULL, 'Log Viewer', 'document', 9),
('alert', NULL, 'Alert', 'bell', 10),
('admin', NULL, 'Admin', 'crown-outline', 11),

-- Depth 2 서브 메뉴 (Icon은 NULL)
('network-management', 'network-monitoring', 'Device Management', NULL, 1),
('network-anomaly', 'network-monitoring', 'Anomaly Monitoring', NULL, 2),

('server-topology', 'server-monitoring', 'Topology Builder', NULL, 1),
('server-list', 'server-monitoring', 'Server List', NULL, 2),
('server-details', 'server-monitoring', 'Server Details', NULL, 3),
('gpu-monitoring', 'server-monitoring', 'NVIDIA GPU Monitoring', NULL, 4),
('server-alert', 'server-monitoring', 'Server Alert', NULL, 5),

('url-list', 'url-monitoring', 'URL List', NULL, 1),
('url-alert', 'url-monitoring', 'URL Alert', NULL, 2),

('k8s-clusters', 'kubernetes', 'Clusters', NULL, 1),
('k8s-nodes', 'kubernetes', 'Nodes', NULL, 2),
('k8s-pods', 'kubernetes', 'Pods', NULL, 3),

('log-analysis', 'log-viewer', 'Log Analysis', NULL, 1),
('logs', 'log-viewer', 'Log Viewer', NULL, 2),
('activity-logs', 'log-viewer', 'Activity Logs', NULL, 3),

('alert-rules', 'alert', 'Alert Setting', NULL, 1),
('alerts', 'alert', 'Alert History', NULL, 2),

('admin-cloudhub', 'admin', 'CloudHub', NULL, 1),
('admin-influxdb', 'admin', 'InfluxDB', NULL, 2)

ON CONFLICT (id) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    label = EXCLUDED.label,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order;

---- create above / drop below ----

DROP INDEX IF EXISTS idx_org_nav_permissions_org_id;
DROP INDEX IF EXISTS idx_nav_menu_items_parent_id;
DROP TABLE IF EXISTS org_nav_permissions;
DROP TABLE IF EXISTS nav_menu_items;

