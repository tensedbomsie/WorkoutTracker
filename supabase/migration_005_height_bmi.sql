-- Add height so BMI can be computed alongside weight.
alter table body_measurements add column if not exists height numeric;
