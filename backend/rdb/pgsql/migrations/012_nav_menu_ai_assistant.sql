-- 012_nav_menu_ai_assistant.sql
-- AI Assistant 메뉴를 마스터 테이블에 등록한다.
--
-- 사이드바에는 이미 AI Assistant 블록이 있지만 nav_menu_items에는 행이 없었다.
-- isOrgNavMenuEnabled가 "selection에 없는 id는 켜짐"으로 동작한 덕에 화면에는
-- 보였지만, Org Menus 관리 화면에는 뜨지 않아 조직별로 끌 수가 없었다.
--
-- 하위 메뉴를 둘로 나눈다. 챗봇과 스킬 관리는 노출 대상이 다르다.
-- 스킬은 Admin만 저작할 수 있고, 적용된 스킬은 게이트웨이 호스트에서 돈다.

INSERT INTO nav_menu_items (id, parent_id, label, icon, sort_order) VALUES
('ai-chat', NULL, 'AI Assistant', 'ai-icon', 12),

('ai-chatbot', 'ai-chat', 'AI Chatbot', NULL, 1),
('openclaw-skills', 'ai-chat', 'Skills', NULL, 2),

-- AI Assistant가 Log Viewer와 Alert 사이에 들어가면서 뒤 두 개가 밀린다.
('alert', NULL, 'Alert', 'bell', 13),
('admin', NULL, 'Admin', 'crown-outline', 14)

ON CONFLICT (id) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    label = EXCLUDED.label,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order;

---- create above / drop below ----

-- ON DELETE RESTRICT는 행 단위로 즉시 검사하므로 자식을 먼저 지운다.
DELETE FROM nav_menu_items WHERE id IN ('ai-chatbot', 'openclaw-skills');
DELETE FROM nav_menu_items WHERE id = 'ai-chat';

UPDATE nav_menu_items SET sort_order = 12 WHERE id = 'alert';
UPDATE nav_menu_items SET sort_order = 13 WHERE id = 'admin';
