WITH target_boards AS (
  SELECT bs.board_id
  FROM board_statuses bs
  JOIN demand_statuses ds ON ds.id = bs.status_id
  WHERE ds.name = 'Solicitações'
),
renumbered AS (
  SELECT bs.id,
         ROW_NUMBER() OVER (
           PARTITION BY bs.board_id
           ORDER BY CASE WHEN ds.name = 'Solicitações' THEN 0 ELSE 1 END, bs.position, ds.name
         ) - 1 AS new_position
  FROM board_statuses bs
  JOIN demand_statuses ds ON ds.id = bs.status_id
  WHERE bs.board_id IN (SELECT board_id FROM target_boards)
)
UPDATE board_statuses bs
SET position = r.new_position
FROM renumbered r
WHERE bs.id = r.id AND bs.position IS DISTINCT FROM r.new_position;