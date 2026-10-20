exports.up = async function(knex) {
  // 1. Roles
  await knex.schema.createTable('roles', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.text('description').nullable();
    table.timestamps(true, true);
  });

  // 2. Permissions
  await knex.schema.createTable('permissions', (table) => {
    table.increments('id').primary();
    table.string('code').notNullable().unique();
    table.string('name').notNullable();
    table.text('description').nullable();
    table.timestamps(true, true);
  });

  // 3. Role Permissions
  await knex.schema.createTable('role_permissions', (table) => {
    table.integer('role_id').unsigned().notNullable()
      .references('id').inTable('roles').onDelete('CASCADE');
    table.integer('permission_id').unsigned().notNullable()
      .references('id').inTable('permissions').onDelete('CASCADE');
    table.primary(['role_id', 'permission_id']);
  });

  // 4. Users
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('username').notNullable().unique();
    table.string('password_hash').notNullable();
    table.string('email').notNullable().unique();
    table.string('status').notNullable().defaultTo('active'); // active, inactive
    table.boolean('force_password_change').notNullable().defaultTo(false);
    table.integer('login_attempts').notNullable().defaultTo(0);
    table.datetime('locked_until').nullable();
    table.timestamps(true, true);
  });

  // 5. User Roles (Many-to-Many support)
  await knex.schema.createTable('user_roles', (table) => {
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('role_id').unsigned().notNullable()
      .references('id').inTable('roles').onDelete('CASCADE');
    table.primary(['user_id', 'role_id']);
  });

  // 6. Refresh Tokens
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('token', 500).notNullable().unique();
    table.datetime('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 7. Password Reset Tokens
  await knex.schema.createTable('password_reset_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('token').notNullable().unique();
    table.datetime('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 8. Departments (department_head_employee_id will be referenced as a loose integer first to avoid circular FK dependencies with employees)
  await knex.schema.createTable('departments', (table) => {
    table.increments('id').primary();
    table.string('code').notNullable().unique();
    table.string('name').notNullable();
    table.integer('department_head_employee_id').unsigned().nullable();
    table.string('location').notNullable();
    table.text('description').nullable();
    table.string('status').notNullable().defaultTo('active'); // active, inactive
    table.timestamps(true, true);
  });

  // 9. Positions
  await knex.schema.createTable('positions', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.text('description').nullable();
    table.timestamps(true, true);
  });

  // 10. Employees
  await knex.schema.createTable('employees', (table) => {
    table.increments('id').primary();
    table.string('employee_number').notNullable().unique();
    table.string('first_name').notNullable();
    table.string('middle_name').nullable();
    table.string('last_name').notNullable();
    table.string('email').notNullable().unique();
    table.string('phone').notNullable();
    table.integer('position_id').unsigned().notNullable()
      .references('id').inTable('positions').onDelete('RESTRICT');
    table.integer('department_id').unsigned().notNullable()
      .references('id').inTable('departments').onDelete('RESTRICT');
    table.string('employment_status').notNullable(); // Regular, Contractual, etc.
    table.date('date_hired').notNullable();
    table.string('status').notNullable().defaultTo('active'); // active, inactive
    table.string('profile_photo_path').nullable();
    table.timestamps(true, true);
  });

  // 11. Asset Categories
  await knex.schema.createTable('asset_categories', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.text('description').nullable();
    table.timestamps(true, true);
  });

  // 12. Assets
  await knex.schema.createTable('assets', (table) => {
    table.increments('id').primary();
    table.string('asset_code').notNullable().unique();
    table.text('qr_code').nullable();
    table.string('barcode').nullable();
    table.string('name').notNullable();
    table.integer('category_id').unsigned().notNullable()
      .references('id').inTable('asset_categories').onDelete('RESTRICT');
    table.string('brand').notNullable();
    table.string('model').notNullable();
    table.string('serial_number').notNullable().unique();
    table.text('description').nullable();
    
    // Specifications
    table.string('specs_cpu').nullable();
    table.string('specs_ram').nullable();
    table.string('specs_storage').nullable();
    table.string('specs_os').nullable();
    table.string('specs_win_edition').nullable();
    
    // Network Details
    table.string('hostname').nullable();
    table.string('mac_address').nullable();
    table.string('ip_address').nullable();
    
    // Acquisition info
    table.date('purchase_date').nullable();
    table.decimal('purchase_price', 10, 2).nullable().defaultTo(0);
    table.string('supplier').nullable();
    table.string('invoice_number').nullable();
    table.date('warranty_start_date').nullable();
    table.date('warranty_end_date').nullable();
    
    // Assignment
    table.integer('department_id').unsigned().nullable()
      .references('id').inTable('departments').onDelete('SET NULL');
    table.integer('employee_id').unsigned().nullable()
      .references('id').inTable('employees').onDelete('SET NULL');
    table.string('current_location').nullable();
    
    // Condition & Status
    table.string('condition').notNullable().defaultTo('Good'); // New, Good, Fair, Poor, Damaged
    table.string('status').notNullable().defaultTo('Available'); // Available, Assigned, In Use, Under Repair, Lost, Damaged, Retired, Disposed
    table.text('remarks').nullable();
    table.string('image_path').nullable();
    
    table.integer('created_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('updated_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });

  // 13. Asset Documents
  await knex.schema.createTable('asset_documents', (table) => {
    table.increments('id').primary();
    table.integer('asset_id').unsigned().notNullable()
      .references('id').inTable('assets').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('file_path').notNullable();
    table.integer('file_size').notNullable();
    table.string('file_type').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 14. Asset History
  await knex.schema.createTable('asset_history', (table) => {
    table.increments('id').primary();
    table.integer('asset_id').unsigned().notNullable()
      .references('id').inTable('assets').onDelete('CASCADE');
    table.string('action').notNullable(); // Create, Assign, Return, Transfer, Update, etc.
    table.text('notes').nullable();
    table.integer('performed_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 15. Asset Assignments
  await knex.schema.createTable('asset_assignments', (table) => {
    table.increments('id').primary();
    table.string('assignment_number').notNullable().unique();
    table.integer('asset_id').unsigned().notNullable()
      .references('id').inTable('assets').onDelete('RESTRICT');
    table.integer('employee_id').unsigned().nullable()
      .references('id').inTable('employees').onDelete('RESTRICT');
    table.integer('department_id').unsigned().nullable()
      .references('id').inTable('departments').onDelete('RESTRICT');
    table.date('date_assigned').notNullable();
    table.date('expected_return_date').nullable();
    table.date('actual_return_date').nullable();
    table.integer('issued_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('received_by').unsigned().nullable()
      .references('id').inTable('employees').onDelete('SET NULL');
    table.string('release_condition').notNullable();
    table.string('return_condition').nullable();
    table.text('remarks').nullable();
    table.string('status').notNullable().defaultTo('Active'); // Active, Returned, Transferred, Lost, Damaged
    table.string('acknowledgment_file_path').nullable();
    table.timestamps(true, true);
  });

  // 16. Ticket Categories
  await knex.schema.createTable('ticket_categories', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.text('description').nullable();
    table.timestamps(true, true);
  });

  // 17. Tickets
  await knex.schema.createTable('tickets', (table) => {
    table.increments('id').primary();
    table.string('ticket_number').notNullable().unique();
    table.integer('requested_by_employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('RESTRICT');
    table.integer('department_id').unsigned().notNullable()
      .references('id').inTable('departments').onDelete('RESTRICT');
    table.integer('category_id').unsigned().notNullable()
      .references('id').inTable('ticket_categories').onDelete('RESTRICT');
    table.string('subject').notNullable();
    table.text('description').notNullable();
    table.string('priority').notNullable().defaultTo('Medium'); // Low, Medium, High, Critical
    table.string('status').notNullable().defaultTo('Open'); // Open, Assigned, In Progress, Waiting for User, Waiting for Parts, Resolved, Closed, Cancelled
    table.integer('assigned_technician_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('related_asset_id').unsigned().nullable()
      .references('id').inTable('assets').onDelete('SET NULL');
    table.string('screenshot_path').nullable();
    table.date('due_date').nullable();
    table.datetime('first_response_date').nullable();
    table.datetime('resolution_date').nullable();
    table.datetime('closed_date').nullable();
    table.text('resolution_summary').nullable();
    table.text('root_cause').nullable();
    table.text('user_feedback').nullable();
    table.integer('user_rating').nullable();
    table.timestamps(true, true);
  });

  // 18. Ticket Comments
  await knex.schema.createTable('ticket_comments', (table) => {
    table.increments('id').primary();
    table.integer('ticket_id').unsigned().notNullable()
      .references('id').inTable('tickets').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.text('comment').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 19. Ticket Internal Notes
  await knex.schema.createTable('ticket_internal_notes', (table) => {
    table.increments('id').primary();
    table.integer('ticket_id').unsigned().notNullable()
      .references('id').inTable('tickets').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.text('note').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 20. Ticket Attachments
  await knex.schema.createTable('ticket_attachments', (table) => {
    table.increments('id').primary();
    table.integer('ticket_id').unsigned().notNullable()
      .references('id').inTable('tickets').onDelete('CASCADE');
    table.string('file_path').notNullable();
    table.string('file_name').notNullable();
    table.integer('file_size').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 21. Ticket History
  await knex.schema.createTable('ticket_history', (table) => {
    table.increments('id').primary();
    table.integer('ticket_id').unsigned().notNullable()
      .references('id').inTable('tickets').onDelete('CASCADE');
    table.string('action').notNullable();
    table.string('old_status').nullable();
    table.string('new_status').nullable();
    table.integer('performed_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 22. Ticket Time Logs
  await knex.schema.createTable('ticket_time_logs', (table) => {
    table.increments('id').primary();
    table.integer('ticket_id').unsigned().notNullable()
      .references('id').inTable('tickets').onDelete('CASCADE');
    table.integer('technician_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.datetime('start_time').notNullable();
    table.datetime('end_time').notNullable();
    table.integer('duration_minutes').notNullable();
    table.text('remarks').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 23. Inventory Categories
  await knex.schema.createTable('inventory_categories', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.text('description').nullable();
    table.timestamps(true, true);
  });

  // 24. Inventory Items
  await knex.schema.createTable('inventory_items', (table) => {
    table.increments('id').primary();
    table.string('item_code').notNullable().unique();
    table.string('barcode').nullable();
    table.string('name').notNullable();
    table.integer('category_id').unsigned().notNullable()
      .references('id').inTable('inventory_categories').onDelete('RESTRICT');
    table.string('brand').notNullable();
    table.string('model').notNullable();
    table.string('unit_of_measure').notNullable(); // Pcs, Meters, Box, etc.
    table.integer('current_quantity').notNullable().defaultTo(0);
    table.integer('minimum_stock').notNullable().defaultTo(5);
    table.integer('reorder_quantity').notNullable().defaultTo(10);
    table.decimal('unit_cost', 10, 2).notNullable().defaultTo(0);
    table.string('supplier').nullable();
    table.string('storage_location').nullable();
    table.string('status').notNullable().defaultTo('Active'); // Active, Inactive
    table.text('remarks').nullable();
    table.timestamps(true, true);
  });

  // 25. Repairs
  await knex.schema.createTable('repairs', (table) => {
    table.increments('id').primary();
    table.string('repair_number').notNullable().unique();
    table.integer('asset_id').unsigned().notNullable()
      .references('id').inTable('assets').onDelete('RESTRICT');
    table.integer('ticket_id').unsigned().nullable()
      .references('id').inTable('tickets').onDelete('SET NULL');
    table.date('date_received').notNullable();
    table.text('reported_issue').notNullable();
    table.text('diagnosis').nullable();
    table.text('root_cause').nullable();
    table.text('repair_action').nullable();
    table.integer('technician_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.decimal('parts_cost', 10, 2).notNullable().defaultTo(0);
    table.decimal('labor_cost', 10, 2).notNullable().defaultTo(0);
    table.decimal('external_service_cost', 10, 2).notNullable().defaultTo(0);
    table.decimal('total_repair_cost', 10, 2).notNullable().defaultTo(0);
    table.date('repair_start_date').nullable();
    table.date('repair_completion_date').nullable();
    table.text('testing_result').nullable();
    table.string('final_condition').nullable(); // Good, Defective, etc.
    table.string('status').notNullable().defaultTo('Received'); // Received, Diagnosing, Waiting for Parts, Repairing, Testing, Completed, Unrepairable, Cancelled
    table.string('before_photo_path').nullable();
    table.string('after_photo_path').nullable();
    table.text('remarks').nullable();
    table.timestamps(true, true);
  });

  // 26. Repair Parts
  await knex.schema.createTable('repair_parts', (table) => {
    table.increments('id').primary();
    table.integer('repair_id').unsigned().notNullable()
      .references('id').inTable('repairs').onDelete('CASCADE');
    table.integer('inventory_item_id').unsigned().notNullable()
      .references('id').inTable('inventory_items').onDelete('RESTRICT');
    table.integer('quantity').notNullable();
    table.decimal('unit_cost', 10, 2).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 27. Maintenance Schedules
  await knex.schema.createTable('maintenance_schedules', (table) => {
    table.increments('id').primary();
    table.string('maintenance_number').notNullable().unique();
    table.integer('asset_id').unsigned().notNullable()
      .references('id').inTable('assets').onDelete('RESTRICT');
    table.string('maintenance_type').notNullable(); // Software, Hardware, Network, General
    table.string('frequency').notNullable(); // Monthly, Quarterly, Semiannual, Annual, Custom
    table.date('scheduled_date').notNullable();
    table.integer('assigned_technician_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.date('next_maintenance_date').nullable();
    table.date('completion_date').nullable();
    table.decimal('cost', 10, 2).notNullable().defaultTo(0);
    table.string('status').notNullable().defaultTo('Scheduled'); // Scheduled, Due, In Progress, Completed, Overdue, Cancelled
    table.text('remarks').nullable();
    table.string('attachments_path').nullable();
    table.timestamps(true, true);
  });

  // 28. Maintenance Checklists
  await knex.schema.createTable('maintenance_checklists', (table) => {
    table.increments('id').primary();
    table.integer('schedule_id').unsigned().notNullable()
      .references('id').inTable('maintenance_schedules').onDelete('CASCADE');
    table.string('checklist_item').notNullable();
    table.boolean('is_checked').notNullable().defaultTo(false);
    table.string('remarks').nullable();
  });

  // 29. Maintenance Results
  await knex.schema.createTable('maintenance_results', (table) => {
    table.increments('id').primary();
    table.integer('schedule_id').unsigned().notNullable()
      .references('id').inTable('maintenance_schedules').onDelete('CASCADE');
    table.text('findings').notNullable();
    table.text('actions_performed').notNullable();
    table.text('parts_used_description').nullable();
    table.decimal('cost', 10, 2).notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 30. Inventory Transactions (Ledger)
  await knex.schema.createTable('inventory_transactions', (table) => {
    table.increments('id').primary();
    table.string('transaction_number').notNullable().unique();
    table.integer('item_id').unsigned().notNullable()
      .references('id').inTable('inventory_items').onDelete('RESTRICT');
    table.string('transaction_type').notNullable(); // Opening Balance, Stock In, Stock Out, Repair Use, Maintenance Use, Adjustment Increase, Adjustment Decrease, Return to Stock
    table.integer('quantity').notNullable();
    table.decimal('unit_cost', 10, 2).notNullable();
    table.string('storage_location').nullable();
    table.integer('related_repair_id').unsigned().nullable()
      .references('id').inTable('repairs').onDelete('SET NULL');
    table.integer('related_maintenance_id').unsigned().nullable()
      .references('id').inTable('maintenance_schedules').onDelete('SET NULL');
    table.text('remarks').nullable();
    table.integer('performed_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 31. Software Licenses
  await knex.schema.createTable('software_licenses', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('vendor').notNullable();
    table.string('license_type').notNullable(); // Subscription, Perpetual, Open Source
    table.string('product_key_encrypted').notNullable();
    table.integer('seats_total').notNullable();
    table.integer('seats_used').notNullable().defaultTo(0);
    table.date('purchase_date').notNullable();
    table.date('expiration_date').nullable();
    table.decimal('purchase_cost', 10, 2).notNullable().defaultTo(0);
    table.string('supplier').nullable();
    table.string('status').notNullable().defaultTo('Available'); // Active, Expiring Soon, Expired, Suspended, Available
    table.string('document_path').nullable();
    table.text('remarks').nullable();
    table.timestamps(true, true);
  });

  // 32. License Assignments
  await knex.schema.createTable('license_assignments', (table) => {
    table.increments('id').primary();
    table.integer('license_id').unsigned().notNullable()
      .references('id').inTable('software_licenses').onDelete('CASCADE');
    table.integer('employee_id').unsigned().nullable()
      .references('id').inTable('employees').onDelete('SET NULL');
    table.integer('asset_id').unsigned().nullable()
      .references('id').inTable('assets').onDelete('SET NULL');
    table.date('assigned_date').notNullable();
    table.string('status').notNullable().defaultTo('Active'); // Active, Returned
    table.text('remarks').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 33. Notifications
  await knex.schema.createTable('notifications', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('title').notNullable();
    table.text('message').notNullable();
    table.string('type').notNullable(); // Info, Warning, Error, Success
    table.boolean('is_read').notNullable().defaultTo(false);
    table.integer('related_record_id').nullable();
    table.string('related_module').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 34. Audit Logs
  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.string('username').nullable();
    table.string('action').notNullable();
    table.string('module').notNullable();
    table.integer('record_id').nullable();
    table.text('old_values').nullable(); // JSON string
    table.text('new_values').nullable(); // JSON string
    table.string('ip_address').notNullable();
    table.string('user_agent').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 35. System Settings
  await knex.schema.createTable('system_settings', (table) => {
    table.string('key').primary();
    table.text('value').notNullable();
    table.text('description').nullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // 36. Number Sequences
  await knex.schema.createTable('number_sequences', (table) => {
    table.string('module').primary(); // Asset, Ticket, Assignment, Repair, Maintenance, Inventory
    table.string('prefix').notNullable();
    table.integer('last_number').notNullable().defaultTo(0);
    table.integer('length').notNullable().defaultTo(6);
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  // Drop tables in reverse order of dependencies
  await knex.schema.dropTableIfExists('number_sequences');
  await knex.schema.dropTableIfExists('system_settings');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('license_assignments');
  await knex.schema.dropTableIfExists('software_licenses');
  await knex.schema.dropTableIfExists('inventory_transactions');
  await knex.schema.dropTableIfExists('maintenance_results');
  await knex.schema.dropTableIfExists('maintenance_checklists');
  await knex.schema.dropTableIfExists('maintenance_schedules');
  await knex.schema.dropTableIfExists('repair_parts');
  await knex.schema.dropTableIfExists('repairs');
  await knex.schema.dropTableIfExists('inventory_items');
  await knex.schema.dropTableIfExists('inventory_categories');
  await knex.schema.dropTableIfExists('ticket_time_logs');
  await knex.schema.dropTableIfExists('ticket_history');
  await knex.schema.dropTableIfExists('ticket_attachments');
  await knex.schema.dropTableIfExists('ticket_internal_notes');
  await knex.schema.dropTableIfExists('ticket_comments');
  await knex.schema.dropTableIfExists('tickets');
  await knex.schema.dropTableIfExists('ticket_categories');
  await knex.schema.dropTableIfExists('asset_assignments');
  await knex.schema.dropTableIfExists('asset_history');
  await knex.schema.dropTableIfExists('asset_documents');
  await knex.schema.dropTableIfExists('assets');
  await knex.schema.dropTableIfExists('asset_categories');
  await knex.schema.dropTableIfExists('employees');
  await knex.schema.dropTableIfExists('positions');
  await knex.schema.dropTableIfExists('departments');
  await knex.schema.dropTableIfExists('password_reset_tokens');
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('permissions');
  await knex.schema.dropTableIfExists('roles');
};
