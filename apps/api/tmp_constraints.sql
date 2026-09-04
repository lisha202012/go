SELECT conname
FROM pg_constraint
WHERE conrelid = '""Mission""'::regclass;
