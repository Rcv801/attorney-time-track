INSERT INTO clients (id, name, email) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Acme Inc.', 'contact@acme.inc'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Stark Industries', 'contact@stark.com');

INSERT INTO matters (id, name, matter_number, rate, client_id) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Project Phoenix', '12345', 150, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Project Titan', '67890', 200, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12');
