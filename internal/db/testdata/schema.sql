CREATE TABLE agency (agency_id text    , agency_name text  NOT NULL  COLLATE NOCASE, agency_url text  NOT NULL  , agency_timezone text  NOT NULL  , agency_lang text    COLLATE NOCASE, agency_phone text    COLLATE NOCASE, agency_fare_url text    , agency_email text    COLLATE NOCASE, cemv_support integer CHECK(cemv_support >= 0 AND cemv_support <= 2 AND (TYPEOF(cemv_support) = 'integer' OR cemv_support IS NULL))   , PRIMARY KEY (agency_id));
CREATE TABLE areas (area_id text  NOT NULL  , area_name text    , PRIMARY KEY (area_id));
CREATE TABLE attributions (attribution_id text    , agency_id text    , route_id text    , trip_id text    , organization_name text  NOT NULL  COLLATE NOCASE, is_producer integer CHECK(is_producer >= 0 AND is_producer <= 1 AND (TYPEOF(is_producer) = 'integer' OR is_producer IS NULL))   , is_operator integer CHECK(is_operator >= 0 AND is_operator <= 1 AND (TYPEOF(is_operator) = 'integer' OR is_operator IS NULL))   , is_authority integer CHECK(is_authority >= 0 AND is_authority <= 1 AND (TYPEOF(is_authority) = 'integer' OR is_authority IS NULL))   , attribution_url text    , attribution_email text    COLLATE NOCASE, attribution_phone text    COLLATE NOCASE, PRIMARY KEY (attribution_id));
CREATE TABLE board_alight (trip_id text  NOT NULL  , stop_id text  NOT NULL  , stop_sequence integer CHECK((TYPEOF(stop_sequence) = 'integer' OR stop_sequence IS NULL)) NOT NULL  , record_use integer CHECK(record_use >= 0 AND record_use <= 1 AND (TYPEOF(record_use) = 'integer' OR record_use IS NULL)) NOT NULL  , schedule_relationship integer CHECK(schedule_relationship >= 0 AND schedule_relationship <= 8 AND (TYPEOF(schedule_relationship) = 'integer' OR schedule_relationship IS NULL))   , boardings integer CHECK((TYPEOF(boardings) = 'integer' OR boardings IS NULL))   , alightings integer CHECK((TYPEOF(alightings) = 'integer' OR alightings IS NULL))   , current_load integer CHECK((TYPEOF(current_load) = 'integer' OR current_load IS NULL))   , load_count integer CHECK((TYPEOF(load_count) = 'integer' OR load_count IS NULL))   , load_type integer CHECK(load_type >= 0 AND load_type <= 1 AND (TYPEOF(load_type) = 'integer' OR load_type IS NULL))   , rack_down integer CHECK(rack_down >= 0 AND rack_down <= 1 AND (TYPEOF(rack_down) = 'integer' OR rack_down IS NULL))   , bike_boardings integer CHECK((TYPEOF(bike_boardings) = 'integer' OR bike_boardings IS NULL))   , bike_alightings integer CHECK((TYPEOF(bike_alightings) = 'integer' OR bike_alightings IS NULL))   , ramp_used integer CHECK(ramp_used >= 0 AND ramp_used <= 1 AND (TYPEOF(ramp_used) = 'integer' OR ramp_used IS NULL))   , ramp_boardings integer CHECK((TYPEOF(ramp_boardings) = 'integer' OR ramp_boardings IS NULL))   , ramp_alightings integer CHECK((TYPEOF(ramp_alightings) = 'integer' OR ramp_alightings IS NULL))   , service_date date    , service_arrival_time time    , service_arrival_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN service_arrival_time IS NULL OR service_arrival_time = '' THEN NULL
              ELSE CAST(
                substr(service_arrival_time, 1, instr(service_arrival_time, ':') - 1) * 3600 +
                substr(service_arrival_time, instr(service_arrival_time, ':') + 1, 2) * 60 +
                substr(service_arrival_time, -2) AS INTEGER
              )
            END
          ) STORED, service_departure_time time    , service_departure_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN service_departure_time IS NULL OR service_departure_time = '' THEN NULL
              ELSE CAST(
                substr(service_departure_time, 1, instr(service_departure_time, ':') - 1) * 3600 +
                substr(service_departure_time, instr(service_departure_time, ':') + 1, 2) * 60 +
                substr(service_departure_time, -2) AS INTEGER
              )
            END
          ) STORED, source integer CHECK(source >= 0 AND source <= 4 AND (TYPEOF(source) = 'integer' OR source IS NULL))   );
CREATE TABLE booking_rules (booking_rule_id text    , booking_type integer CHECK(booking_type >= 0 AND booking_type <= 2 AND (TYPEOF(booking_type) = 'integer' OR booking_type IS NULL)) NOT NULL  , prior_notice_duration_min integer CHECK((TYPEOF(prior_notice_duration_min) = 'integer' OR prior_notice_duration_min IS NULL))   , prior_notice_duration_max integer CHECK((TYPEOF(prior_notice_duration_max) = 'integer' OR prior_notice_duration_max IS NULL))   , prior_notice_last_day integer CHECK((TYPEOF(prior_notice_last_day) = 'integer' OR prior_notice_last_day IS NULL))   , prior_notice_last_time time    , prior_notice_last_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN prior_notice_last_time IS NULL OR prior_notice_last_time = '' THEN NULL
              ELSE CAST(
                substr(prior_notice_last_time, 1, instr(prior_notice_last_time, ':') - 1) * 3600 +
                substr(prior_notice_last_time, instr(prior_notice_last_time, ':') + 1, 2) * 60 +
                substr(prior_notice_last_time, -2) AS INTEGER
              )
            END
          ) STORED, prior_notice_start_day integer CHECK((TYPEOF(prior_notice_start_day) = 'integer' OR prior_notice_start_day IS NULL))   , prior_notice_start_time time    , prior_notice_start_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN prior_notice_start_time IS NULL OR prior_notice_start_time = '' THEN NULL
              ELSE CAST(
                substr(prior_notice_start_time, 1, instr(prior_notice_start_time, ':') - 1) * 3600 +
                substr(prior_notice_start_time, instr(prior_notice_start_time, ':') + 1, 2) * 60 +
                substr(prior_notice_start_time, -2) AS INTEGER
              )
            END
          ) STORED, prior_notice_service_id text    , message text    COLLATE NOCASE, pickup_message text    COLLATE NOCASE, drop_off_message text    COLLATE NOCASE, phone_number text    COLLATE NOCASE, info_url text    , booking_url text    , PRIMARY KEY (booking_rule_id));
CREATE TABLE calendar (service_id text  NOT NULL  , monday integer CHECK(monday >= 0 AND monday <= 1 AND (TYPEOF(monday) = 'integer' OR monday IS NULL)) NOT NULL  , tuesday integer CHECK(tuesday >= 0 AND tuesday <= 1 AND (TYPEOF(tuesday) = 'integer' OR tuesday IS NULL)) NOT NULL  , wednesday integer CHECK(wednesday >= 0 AND wednesday <= 1 AND (TYPEOF(wednesday) = 'integer' OR wednesday IS NULL)) NOT NULL  , thursday integer CHECK(thursday >= 0 AND thursday <= 1 AND (TYPEOF(thursday) = 'integer' OR thursday IS NULL)) NOT NULL  , friday integer CHECK(friday >= 0 AND friday <= 1 AND (TYPEOF(friday) = 'integer' OR friday IS NULL)) NOT NULL  , saturday integer CHECK(saturday >= 0 AND saturday <= 1 AND (TYPEOF(saturday) = 'integer' OR saturday IS NULL)) NOT NULL  , sunday integer CHECK(sunday >= 0 AND sunday <= 1 AND (TYPEOF(sunday) = 'integer' OR sunday IS NULL)) NOT NULL  , start_date date  NOT NULL  , end_date date  NOT NULL  , PRIMARY KEY (service_id));
CREATE TABLE calendar_attributes (service_id text    , service_description text  NOT NULL  COLLATE NOCASE, PRIMARY KEY (service_id));
CREATE TABLE calendar_dates (service_id text  NOT NULL  , date date  NOT NULL  , exception_type integer CHECK(exception_type >= 1 AND exception_type <= 2 AND (TYPEOF(exception_type) = 'integer' OR exception_type IS NULL)) NOT NULL  , holiday_name text    COLLATE NOCASE, PRIMARY KEY (service_id, date));
CREATE TABLE deadhead_times (deadhead_id text  NOT NULL  , arrival_time time  NOT NULL  , arrival_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN arrival_time IS NULL OR arrival_time = '' THEN NULL
              ELSE CAST(
                substr(arrival_time, 1, instr(arrival_time, ':') - 1) * 3600 +
                substr(arrival_time, instr(arrival_time, ':') + 1, 2) * 60 +
                substr(arrival_time, -2) AS INTEGER
              )
            END
          ) STORED, departure_time time  NOT NULL  , departure_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN departure_time IS NULL OR departure_time = '' THEN NULL
              ELSE CAST(
                substr(departure_time, 1, instr(departure_time, ':') - 1) * 3600 +
                substr(departure_time, instr(departure_time, ':') + 1, 2) * 60 +
                substr(departure_time, -2) AS INTEGER
              )
            END
          ) STORED, ops_location_id text    , stop_id text    , location_sequence integer CHECK((TYPEOF(location_sequence) = 'integer' OR location_sequence IS NULL)) NOT NULL  , shape_dist_traveled real CHECK((TYPEOF(shape_dist_traveled) = 'real' OR shape_dist_traveled IS NULL))   , PRIMARY KEY (deadhead_id, location_sequence));
CREATE TABLE deadheads (deadhead_id text  NOT NULL  , service_id text  NOT NULL  , block_id text  NOT NULL  , shape_id text    , to_trip_id text    , from_trip_id text    , to_deadhead_id text    , from_deadhead_id text    , PRIMARY KEY (deadhead_id));
CREATE TABLE devices (device_id text  NOT NULL  , stop_id text    , vehicle_id text    , train_car_id text    , device_type text    , device_vendor text    , device_model text    , device_location text    , PRIMARY KEY (device_id));
CREATE TABLE directions (route_id text  NOT NULL  , direction_id integer CHECK(direction_id >= 0 AND direction_id <= 1 AND (TYPEOF(direction_id) = 'integer' OR direction_id IS NULL))   , direction text  NOT NULL  , PRIMARY KEY (route_id, direction_id));
CREATE TABLE fare_attributes (fare_id text  NOT NULL  , price real CHECK((TYPEOF(price) = 'real' OR price IS NULL)) NOT NULL  , currency_type text  NOT NULL  , payment_method integer CHECK(payment_method >= 0 AND payment_method <= 1 AND (TYPEOF(payment_method) = 'integer' OR payment_method IS NULL)) NOT NULL  , transfers integer CHECK(transfers >= 0 AND transfers <= 2 AND (TYPEOF(transfers) = 'integer' OR transfers IS NULL))   , agency_id text    , transfer_duration integer CHECK((TYPEOF(transfer_duration) = 'integer' OR transfer_duration IS NULL))   , PRIMARY KEY (fare_id));
CREATE TABLE fare_leg_rules (leg_group_id text    , network_id text    , from_area_id text    , to_area_id text    , from_timeframe_group_id text    , to_timeframe_group_id text    , fare_product_id text  NOT NULL  , rule_priority integer CHECK((TYPEOF(rule_priority) = 'integer' OR rule_priority IS NULL))   , PRIMARY KEY (network_id, from_area_id, to_area_id, from_timeframe_group_id, to_timeframe_group_id, fare_product_id));
CREATE TABLE fare_media (fare_media_id text  NOT NULL  , fare_media_name text    , fare_media_type integer CHECK(fare_media_type >= 0 AND fare_media_type <= 4 AND (TYPEOF(fare_media_type) = 'integer' OR fare_media_type IS NULL)) NOT NULL  , PRIMARY KEY (fare_media_id));
CREATE TABLE fare_products (fare_product_id text  NOT NULL  , rider_category_id text    , fare_product_name text    , fare_media_id text    , amount real CHECK((TYPEOF(amount) = 'real' OR amount IS NULL)) NOT NULL  , currency text  NOT NULL  , PRIMARY KEY (fare_product_id, rider_category_id, fare_media_id));
CREATE TABLE fare_rules (fare_id text  NOT NULL  , route_id text    , origin_id text    , destination_id text    , contains_id text    , PRIMARY KEY (fare_id, route_id, origin_id, destination_id, contains_id));
CREATE TABLE fare_transactions (transaction_id text  NOT NULL  , service_date date  NOT NULL  , event_timestamp text  NOT NULL  , location_ping_id text    , amount real CHECK((TYPEOF(amount) = 'real' OR amount IS NULL)) NOT NULL  , currency_type text    , fare_action text  NOT NULL  , trip_id_performed text    , trip_id_scheduled text    , pattern_id text    , trip_stop_sequence integer CHECK(trip_stop_sequence >= 1 AND (TYPEOF(trip_stop_sequence) = 'integer' OR trip_stop_sequence IS NULL))   , scheduled_stop_sequence integer CHECK((TYPEOF(scheduled_stop_sequence) = 'integer' OR scheduled_stop_sequence IS NULL))   , vehicle_id text    , device_id text    , fare_id text    , stop_id text    , num_riders integer CHECK((TYPEOF(num_riders) = 'integer' OR num_riders IS NULL))   , fare_media_id text    , rider_category text    , fare_product text    , fare_period text    , fare_capped text  NOT NULL  , token_id text    , balance real CHECK((TYPEOF(balance) = 'real' OR balance IS NULL))   );
CREATE TABLE fare_transfer_rules (from_leg_group_id text    , to_leg_group_id text    , transfer_count integer CHECK(transfer_count >= -1 AND (TYPEOF(transfer_count) = 'integer' OR transfer_count IS NULL))   , duration_limit integer CHECK((TYPEOF(duration_limit) = 'integer' OR duration_limit IS NULL))   , duration_limit_type integer CHECK(duration_limit_type >= 0 AND duration_limit_type <= 3 AND (TYPEOF(duration_limit_type) = 'integer' OR duration_limit_type IS NULL))   , fare_transfer_type integer CHECK(fare_transfer_type >= 0 AND fare_transfer_type <= 2 AND (TYPEOF(fare_transfer_type) = 'integer' OR fare_transfer_type IS NULL)) NOT NULL  , fare_product_id text    , PRIMARY KEY (from_leg_group_id, to_leg_group_id, transfer_count, duration_limit, fare_product_id));
CREATE TABLE feed_info (feed_publisher_name text  NOT NULL  COLLATE NOCASE, feed_publisher_url text  NOT NULL  , feed_lang text  NOT NULL  , default_lang text    COLLATE NOCASE, feed_start_date date    , feed_end_date date    , feed_version text    , feed_contact_email text    COLLATE NOCASE, feed_contact_url text    );
CREATE TABLE frequencies (trip_id text  NOT NULL  , start_time time  NOT NULL  , start_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN start_time IS NULL OR start_time = '' THEN NULL
              ELSE CAST(
                substr(start_time, 1, instr(start_time, ':') - 1) * 3600 +
                substr(start_time, instr(start_time, ':') + 1, 2) * 60 +
                substr(start_time, -2) AS INTEGER
              )
            END
          ) STORED, end_time time  NOT NULL  , end_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN end_time IS NULL OR end_time = '' THEN NULL
              ELSE CAST(
                substr(end_time, 1, instr(end_time, ':') - 1) * 3600 +
                substr(end_time, instr(end_time, ':') + 1, 2) * 60 +
                substr(end_time, -2) AS INTEGER
              )
            END
          ) STORED, headway_secs integer CHECK((TYPEOF(headway_secs) = 'integer' OR headway_secs IS NULL)) NOT NULL  , exact_times integer CHECK(exact_times >= 0 AND exact_times <= 1 AND (TYPEOF(exact_times) = 'integer' OR exact_times IS NULL))   , PRIMARY KEY (trip_id, start_time));
CREATE TABLE levels (level_id text  NOT NULL  , level_index real CHECK((TYPEOF(level_index) = 'real' OR level_index IS NULL)) NOT NULL  , level_name text    COLLATE NOCASE, PRIMARY KEY (level_id));
CREATE TABLE location_group_stops (location_group_id text  NOT NULL  , stop_id text  NOT NULL  , PRIMARY KEY (location_group_id, stop_id));
CREATE TABLE location_groups (location_group_id text    , location_group_name text    COLLATE NOCASE, PRIMARY KEY (location_group_id));
CREATE TABLE locations (geojson text    );
CREATE TABLE networks (network_id text  NOT NULL  , network_name text    COLLATE NOCASE, PRIMARY KEY (network_id));
CREATE TABLE operators (operator_id text  NOT NULL  , PRIMARY KEY (operator_id));
CREATE TABLE ops_locations (ops_location_id text  NOT NULL  , ops_location_code text    , ops_location_name text  NOT NULL  COLLATE NOCASE, ops_location_desc text    COLLATE NOCASE, ops_location_lat real CHECK(ops_location_lat >= -90 AND ops_location_lat <= 90 AND (TYPEOF(ops_location_lat) = 'real' OR ops_location_lat IS NULL)) NOT NULL  , ops_location_lon real CHECK(ops_location_lon >= -180 AND ops_location_lon <= 180 AND (TYPEOF(ops_location_lon) = 'real' OR ops_location_lon IS NULL)) NOT NULL  , PRIMARY KEY (ops_location_id));
CREATE TABLE passenger_events (passenger_event_id text  NOT NULL  , service_date date  NOT NULL  , event_timestamp text  NOT NULL  , location_ping_id text    , trip_id_performed text    , trip_id_scheduled text    , trip_stop_sequence integer CHECK(trip_stop_sequence >= 1 AND (TYPEOF(trip_stop_sequence) = 'integer' OR trip_stop_sequence IS NULL))   , scheduled_stop_sequence integer CHECK((TYPEOF(scheduled_stop_sequence) = 'integer' OR scheduled_stop_sequence IS NULL))   , event_type text  NOT NULL  , vehicle_id text  NOT NULL  , device_id text    , train_car_id text    , stop_id text    , pattern_id text    , event_count integer CHECK((TYPEOF(event_count) = 'integer' OR event_count IS NULL))   );
CREATE TABLE pathways (pathway_id text  NOT NULL  , from_stop_id text  NOT NULL  , to_stop_id text  NOT NULL  , pathway_mode integer CHECK(pathway_mode >= 1 AND pathway_mode <= 7 AND (TYPEOF(pathway_mode) = 'integer' OR pathway_mode IS NULL)) NOT NULL  , is_bidirectional integer CHECK(is_bidirectional >= 0 AND is_bidirectional <= 1 AND (TYPEOF(is_bidirectional) = 'integer' OR is_bidirectional IS NULL)) NOT NULL  , length real CHECK((TYPEOF(length) = 'real' OR length IS NULL))   , traversal_time integer CHECK((TYPEOF(traversal_time) = 'integer' OR traversal_time IS NULL))   , stair_count integer CHECK((TYPEOF(stair_count) = 'integer' OR stair_count IS NULL))   , max_slope real CHECK((TYPEOF(max_slope) = 'real' OR max_slope IS NULL))   , min_width real CHECK((TYPEOF(min_width) = 'real' OR min_width IS NULL))   , signposted_as text    COLLATE NOCASE, reversed_signposted_as text    COLLATE NOCASE, PRIMARY KEY (pathway_id));
CREATE TABLE ride_feed_info (ride_files integer CHECK(ride_files >= 0 AND ride_files <= 6 AND (TYPEOF(ride_files) = 'integer' OR ride_files IS NULL)) NOT NULL  , ride_start_date date    , ride_end_date date    , gtfs_feed_date date    , default_currency_type text    , ride_feed_version text    );
CREATE TABLE rider_categories (rider_category_id text  NOT NULL  , rider_category_name text  NOT NULL  , is_default_fare_category integer CHECK(is_default_fare_category >= 0 AND is_default_fare_category <= 1 AND (TYPEOF(is_default_fare_category) = 'integer' OR is_default_fare_category IS NULL))   , eligibility_url text    , PRIMARY KEY (rider_category_id));
CREATE TABLE rider_trip (rider_id text    , agency_id text    , trip_id text    , boarding_stop_id text    , boarding_stop_sequence integer CHECK((TYPEOF(boarding_stop_sequence) = 'integer' OR boarding_stop_sequence IS NULL))   , alighting_stop_id text    , alighting_stop_sequence integer CHECK((TYPEOF(alighting_stop_sequence) = 'integer' OR alighting_stop_sequence IS NULL))   , service_date date    , boarding_time time    , boarding_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN boarding_time IS NULL OR boarding_time = '' THEN NULL
              ELSE CAST(
                substr(boarding_time, 1, instr(boarding_time, ':') - 1) * 3600 +
                substr(boarding_time, instr(boarding_time, ':') + 1, 2) * 60 +
                substr(boarding_time, -2) AS INTEGER
              )
            END
          ) STORED, alighting_time time    , alighting_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN alighting_time IS NULL OR alighting_time = '' THEN NULL
              ELSE CAST(
                substr(alighting_time, 1, instr(alighting_time, ':') - 1) * 3600 +
                substr(alighting_time, instr(alighting_time, ':') + 1, 2) * 60 +
                substr(alighting_time, -2) AS INTEGER
              )
            END
          ) STORED, rider_type integer CHECK(rider_type >= 0 AND rider_type <= 13 AND (TYPEOF(rider_type) = 'integer' OR rider_type IS NULL))   , rider_type_description text    , fare_paid real CHECK((TYPEOF(fare_paid) = 'real' OR fare_paid IS NULL))   , transaction_type integer CHECK(transaction_type >= 0 AND transaction_type <= 8 AND (TYPEOF(transaction_type) = 'integer' OR transaction_type IS NULL))   , fare_media integer CHECK(fare_media >= 0 AND fare_media <= 9 AND (TYPEOF(fare_media) = 'integer' OR fare_media IS NULL))   , accompanying_device integer CHECK(accompanying_device >= 0 AND accompanying_device <= 6 AND (TYPEOF(accompanying_device) = 'integer' OR accompanying_device IS NULL))   , transfer_status integer CHECK(transfer_status >= 0 AND transfer_status <= 1 AND (TYPEOF(transfer_status) = 'integer' OR transfer_status IS NULL))   , PRIMARY KEY (rider_id));
CREATE TABLE ridership (total_boardings integer CHECK((TYPEOF(total_boardings) = 'integer' OR total_boardings IS NULL)) NOT NULL  , total_alightings integer CHECK((TYPEOF(total_alightings) = 'integer' OR total_alightings IS NULL)) NOT NULL  , ridership_start_date date    , ridership_end_date date    , ridership_start_time time    , ridership_start_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN ridership_start_time IS NULL OR ridership_start_time = '' THEN NULL
              ELSE CAST(
                substr(ridership_start_time, 1, instr(ridership_start_time, ':') - 1) * 3600 +
                substr(ridership_start_time, instr(ridership_start_time, ':') + 1, 2) * 60 +
                substr(ridership_start_time, -2) AS INTEGER
              )
            END
          ) STORED, ridership_end_time time    , ridership_end_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN ridership_end_time IS NULL OR ridership_end_time = '' THEN NULL
              ELSE CAST(
                substr(ridership_end_time, 1, instr(ridership_end_time, ':') - 1) * 3600 +
                substr(ridership_end_time, instr(ridership_end_time, ':') + 1, 2) * 60 +
                substr(ridership_end_time, -2) AS INTEGER
              )
            END
          ) STORED, service_id text    , monday integer CHECK(monday >= 0 AND monday <= 1 AND (TYPEOF(monday) = 'integer' OR monday IS NULL))   , tuesday integer CHECK(tuesday >= 0 AND tuesday <= 1 AND (TYPEOF(tuesday) = 'integer' OR tuesday IS NULL))   , wednesday integer CHECK(wednesday >= 0 AND wednesday <= 1 AND (TYPEOF(wednesday) = 'integer' OR wednesday IS NULL))   , thursday integer CHECK(thursday >= 0 AND thursday <= 1 AND (TYPEOF(thursday) = 'integer' OR thursday IS NULL))   , friday integer CHECK(friday >= 0 AND friday <= 1 AND (TYPEOF(friday) = 'integer' OR friday IS NULL))   , saturday integer CHECK(saturday >= 0 AND saturday <= 1 AND (TYPEOF(saturday) = 'integer' OR saturday IS NULL))   , sunday integer CHECK(sunday >= 0 AND sunday <= 1 AND (TYPEOF(sunday) = 'integer' OR sunday IS NULL))   , agency_id text    , route_id text    , direction_id integer CHECK(direction_id >= 0 AND direction_id <= 1 AND (TYPEOF(direction_id) = 'integer' OR direction_id IS NULL))   , trip_id text    , stop_id text    );
CREATE TABLE route_attributes (route_id text    , category integer CHECK((TYPEOF(category) = 'integer' OR category IS NULL)) NOT NULL  , subcategory integer CHECK(subcategory >= 101 AND (TYPEOF(subcategory) = 'integer' OR subcategory IS NULL)) NOT NULL  , running_way integer CHECK(running_way >= 1 AND (TYPEOF(running_way) = 'integer' OR running_way IS NULL)) NOT NULL  , PRIMARY KEY (route_id));
CREATE TABLE route_networks (network_id text  NOT NULL  , route_id text    , PRIMARY KEY (route_id));
CREATE TABLE routes (route_id text  NOT NULL  , agency_id text    , route_short_name text    COLLATE NOCASE, route_long_name text    COLLATE NOCASE, route_desc text    COLLATE NOCASE, route_type integer CHECK((TYPEOF(route_type) = 'integer' OR route_type IS NULL)) NOT NULL  , route_url text    , route_color text    COLLATE NOCASE, route_text_color text    COLLATE NOCASE, route_sort_order integer CHECK((TYPEOF(route_sort_order) = 'integer' OR route_sort_order IS NULL))   , continuous_pickup integer CHECK(continuous_pickup >= 0 AND continuous_pickup <= 3 AND (TYPEOF(continuous_pickup) = 'integer' OR continuous_pickup IS NULL))   , continuous_drop_off integer CHECK(continuous_drop_off >= 0 AND continuous_drop_off <= 3 AND (TYPEOF(continuous_drop_off) = 'integer' OR continuous_drop_off IS NULL))   , network_id text    , cemv_support integer CHECK(cemv_support >= 0 AND cemv_support <= 2 AND (TYPEOF(cemv_support) = 'integer' OR cemv_support IS NULL))   , PRIMARY KEY (route_id));
CREATE TABLE run_event (run_event_id text  NOT NULL  , piece_id text  NOT NULL  , event_type integer CHECK((TYPEOF(event_type) = 'integer' OR event_type IS NULL)) NOT NULL  , event_name text    COLLATE NOCASE, event_time text  NOT NULL  , event_duration integer CHECK((TYPEOF(event_duration) = 'integer' OR event_duration IS NULL)) NOT NULL  , event_from_location_type integer CHECK(event_from_location_type >= 0 AND event_from_location_type <= 1 AND (TYPEOF(event_from_location_type) = 'integer' OR event_from_location_type IS NULL))   , event_from_location_id text    , event_to_location_type integer CHECK(event_to_location_type >= 0 AND event_to_location_type <= 1 AND (TYPEOF(event_to_location_type) = 'integer' OR event_to_location_type IS NULL))   , event_to_location_id text    , PRIMARY KEY (run_event_id));
CREATE TABLE runs_pieces (run_id text  NOT NULL  , piece_id text  NOT NULL  , start_type integer CHECK(start_type >= 0 AND start_type <= 2 AND (TYPEOF(start_type) = 'integer' OR start_type IS NULL)) NOT NULL  , start_trip_id text  NOT NULL  , start_trip_position integer CHECK((TYPEOF(start_trip_position) = 'integer' OR start_trip_position IS NULL))   , end_type integer CHECK(end_type >= 0 AND end_type <= 2 AND (TYPEOF(end_type) = 'integer' OR end_type IS NULL)) NOT NULL  , end_trip_id text  NOT NULL  , end_trip_position integer CHECK((TYPEOF(end_trip_position) = 'integer' OR end_trip_position IS NULL))   , PRIMARY KEY (piece_id));
CREATE TABLE service_alert_informed_entities (alert_id text  NOT NULL  , stop_id text    , route_id text    , route_type integer CHECK((TYPEOF(route_type) = 'integer' OR route_type IS NULL))   , trip_id text    , direction_id integer CHECK((TYPEOF(direction_id) = 'integer' OR direction_id IS NULL))   , created_timestamp integer CHECK((TYPEOF(created_timestamp) = 'integer' OR created_timestamp IS NULL)) NOT NULL  , expiration_timestamp integer CHECK((TYPEOF(expiration_timestamp) = 'integer' OR expiration_timestamp IS NULL)) NOT NULL  , PRIMARY KEY (alert_id));
CREATE TABLE service_alerts (id text  NOT NULL  , active_period json    , cause text    , effect text    , url text    , start_time text  NOT NULL  , end_time text  NOT NULL  , header_text text  NOT NULL  , description_text text  NOT NULL  , tts_header_text text    , tts_description_text text    , severity_level text    , created_timestamp integer CHECK((TYPEOF(created_timestamp) = 'integer' OR created_timestamp IS NULL)) NOT NULL  , expiration_timestamp integer CHECK((TYPEOF(expiration_timestamp) = 'integer' OR expiration_timestamp IS NULL)) NOT NULL  , PRIMARY KEY (id));
CREATE TABLE shapes (shape_id text  NOT NULL  , shape_pt_lat real CHECK(shape_pt_lat >= -90 AND shape_pt_lat <= 90 AND (TYPEOF(shape_pt_lat) = 'real' OR shape_pt_lat IS NULL)) NOT NULL  , shape_pt_lon real CHECK(shape_pt_lon >= -180 AND shape_pt_lon <= 180 AND (TYPEOF(shape_pt_lon) = 'real' OR shape_pt_lon IS NULL)) NOT NULL  , shape_pt_sequence integer CHECK((TYPEOF(shape_pt_sequence) = 'integer' OR shape_pt_sequence IS NULL)) NOT NULL  , shape_dist_traveled real CHECK((TYPEOF(shape_dist_traveled) = 'real' OR shape_dist_traveled IS NULL))   , PRIMARY KEY (shape_id, shape_pt_sequence));
CREATE TABLE station_activities (service_date date  NOT NULL  , stop_id text  NOT NULL  , time_period_start text  NOT NULL  , time_period_end text  NOT NULL  , time_period_category text    , total_entries integer CHECK((TYPEOF(total_entries) = 'integer' OR total_entries IS NULL))   , total_exits integer CHECK((TYPEOF(total_exits) = 'integer' OR total_exits IS NULL))   , number_of_transactions integer CHECK((TYPEOF(number_of_transactions) = 'integer' OR number_of_transactions IS NULL))   , bike_entries integer CHECK((TYPEOF(bike_entries) = 'integer' OR bike_entries IS NULL))   , bike_exits integer CHECK((TYPEOF(bike_exits) = 'integer' OR bike_exits IS NULL))   , ramp_entries integer CHECK((TYPEOF(ramp_entries) = 'integer' OR ramp_entries IS NULL))   , ramp_exits integer CHECK((TYPEOF(ramp_exits) = 'integer' OR ramp_exits IS NULL))   , PRIMARY KEY (service_date, stop_id, time_period_start, time_period_end));
CREATE TABLE stop_areas (area_id text  NOT NULL  , stop_id text  NOT NULL  , PRIMARY KEY (area_id, stop_id));
CREATE TABLE stop_attributes (stop_id text  NOT NULL  , accessibility_id integer CHECK((TYPEOF(accessibility_id) = 'integer' OR accessibility_id IS NULL))   , cardinal_direction text    , relative_position text    , stop_city text    COLLATE NOCASE, PRIMARY KEY (stop_id));
CREATE TABLE stop_time_updates (trip_id text    , trip_start_time text    , direction_id integer CHECK((TYPEOF(direction_id) = 'integer' OR direction_id IS NULL))   , route_id text    , stop_id text    , stop_sequence integer CHECK((TYPEOF(stop_sequence) = 'integer' OR stop_sequence IS NULL))   , arrival_delay integer CHECK((TYPEOF(arrival_delay) = 'integer' OR arrival_delay IS NULL))   , departure_delay integer CHECK((TYPEOF(departure_delay) = 'integer' OR departure_delay IS NULL))   , departure_timestamp text    , arrival_timestamp text    , schedule_relationship text    , created_timestamp integer CHECK((TYPEOF(created_timestamp) = 'integer' OR created_timestamp IS NULL)) NOT NULL  , expiration_timestamp integer CHECK((TYPEOF(expiration_timestamp) = 'integer' OR expiration_timestamp IS NULL)) NOT NULL  );
CREATE TABLE stop_times (trip_id text  NOT NULL  , arrival_time time    , arrival_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN arrival_time IS NULL OR arrival_time = '' THEN NULL
              ELSE CAST(
                substr(arrival_time, 1, instr(arrival_time, ':') - 1) * 3600 +
                substr(arrival_time, instr(arrival_time, ':') + 1, 2) * 60 +
                substr(arrival_time, -2) AS INTEGER
              )
            END
          ) STORED, departure_time time    , departure_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN departure_time IS NULL OR departure_time = '' THEN NULL
              ELSE CAST(
                substr(departure_time, 1, instr(departure_time, ':') - 1) * 3600 +
                substr(departure_time, instr(departure_time, ':') + 1, 2) * 60 +
                substr(departure_time, -2) AS INTEGER
              )
            END
          ) STORED, location_group_id text    , location_id text    , stop_id text  NOT NULL  , stop_sequence integer CHECK((TYPEOF(stop_sequence) = 'integer' OR stop_sequence IS NULL)) NOT NULL  , stop_headsign text    COLLATE NOCASE, start_pickup_drop_off_window time    , start_pickup_drop_off_window_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN start_pickup_drop_off_window IS NULL OR start_pickup_drop_off_window = '' THEN NULL
              ELSE CAST(
                substr(start_pickup_drop_off_window, 1, instr(start_pickup_drop_off_window, ':') - 1) * 3600 +
                substr(start_pickup_drop_off_window, instr(start_pickup_drop_off_window, ':') + 1, 2) * 60 +
                substr(start_pickup_drop_off_window, -2) AS INTEGER
              )
            END
          ) STORED, pickup_type integer CHECK(pickup_type >= 0 AND pickup_type <= 3 AND (TYPEOF(pickup_type) = 'integer' OR pickup_type IS NULL))   , drop_off_type integer CHECK(drop_off_type >= 0 AND drop_off_type <= 3 AND (TYPEOF(drop_off_type) = 'integer' OR drop_off_type IS NULL))   , continuous_pickup integer CHECK(continuous_pickup >= 0 AND continuous_pickup <= 3 AND (TYPEOF(continuous_pickup) = 'integer' OR continuous_pickup IS NULL))   , continuous_drop_off integer CHECK(continuous_drop_off >= 0 AND continuous_drop_off <= 3 AND (TYPEOF(continuous_drop_off) = 'integer' OR continuous_drop_off IS NULL))   , shape_dist_traveled real CHECK((TYPEOF(shape_dist_traveled) = 'real' OR shape_dist_traveled IS NULL))   , timepoint integer CHECK(timepoint >= 0 AND timepoint <= 1 AND (TYPEOF(timepoint) = 'integer' OR timepoint IS NULL))   , pickup_booking_rule_id text    , drop_off_booking_rule_id text    , PRIMARY KEY (trip_id, stop_sequence));
CREATE TABLE stop_visits (service_date date  NOT NULL  , trip_id_performed text  NOT NULL  , trip_stop_sequence integer CHECK(trip_stop_sequence >= 1 AND (TYPEOF(trip_stop_sequence) = 'integer' OR trip_stop_sequence IS NULL)) NOT NULL  , scheduled_stop_sequence integer CHECK((TYPEOF(scheduled_stop_sequence) = 'integer' OR scheduled_stop_sequence IS NULL))   , pattern_id text    , vehicle_id text    , dwell integer CHECK((TYPEOF(dwell) = 'integer' OR dwell IS NULL))   , stop_id text    , timepoint text    , schedule_arrival_time text    , schedule_departure_time text    , actual_arrival_time text    , actual_departure_time text    , distance integer CHECK((TYPEOF(distance) = 'integer' OR distance IS NULL))   , boarding_1 integer CHECK((TYPEOF(boarding_1) = 'integer' OR boarding_1 IS NULL))   , alighting_1 integer CHECK((TYPEOF(alighting_1) = 'integer' OR alighting_1 IS NULL))   , boarding_2 integer CHECK((TYPEOF(boarding_2) = 'integer' OR boarding_2 IS NULL))   , alighting_2 integer CHECK((TYPEOF(alighting_2) = 'integer' OR alighting_2 IS NULL))   , departure_load integer CHECK((TYPEOF(departure_load) = 'integer' OR departure_load IS NULL))   , door_open text    , door_close text    , door_status text    , ramp_deployed_time text    , ramp_failure text    , kneel_deployed_time integer CHECK((TYPEOF(kneel_deployed_time) = 'integer' OR kneel_deployed_time IS NULL))   , lift_deployed_time integer CHECK((TYPEOF(lift_deployed_time) = 'integer' OR lift_deployed_time IS NULL))   , bike_rack_deployed text    , bike_load integer CHECK((TYPEOF(bike_load) = 'integer' OR bike_load IS NULL))   , revenue real CHECK((TYPEOF(revenue) = 'real' OR revenue IS NULL))   , number_of_transactions integer CHECK((TYPEOF(number_of_transactions) = 'integer' OR number_of_transactions IS NULL))   , schedule_relationship text    , PRIMARY KEY (service_date, trip_id_performed, trip_stop_sequence));
CREATE TABLE stops (stop_id text  NOT NULL  , stop_code text    , stop_name text    COLLATE NOCASE, tts_stop_name text    COLLATE NOCASE, stop_desc text    COLLATE NOCASE, stop_lat real CHECK(stop_lat >= -90 AND stop_lat <= 90 AND (TYPEOF(stop_lat) = 'real' OR stop_lat IS NULL))   , stop_lon real CHECK(stop_lon >= -180 AND stop_lon <= 180 AND (TYPEOF(stop_lon) = 'real' OR stop_lon IS NULL))   , zone_id text    , stop_url text    , location_type integer CHECK(location_type >= 0 AND location_type <= 4 AND (TYPEOF(location_type) = 'integer' OR location_type IS NULL))   , parent_station text    , stop_timezone text    , wheelchair_boarding integer CHECK(wheelchair_boarding >= 0 AND wheelchair_boarding <= 2 AND (TYPEOF(wheelchair_boarding) = 'integer' OR wheelchair_boarding IS NULL))   , level_id text    , platform_code text    , stop_access integer CHECK(stop_access >= 0 AND stop_access <= 1 AND (TYPEOF(stop_access) = 'integer' OR stop_access IS NULL))   , stop_name_fold TEXT, station_category integer, PRIMARY KEY (stop_id));
CREATE TABLE timeframes (timeframe_group_id text    , start_time time    , start_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN start_time IS NULL OR start_time = '' THEN NULL
              ELSE CAST(
                substr(start_time, 1, instr(start_time, ':') - 1) * 3600 +
                substr(start_time, instr(start_time, ':') + 1, 2) * 60 +
                substr(start_time, -2) AS INTEGER
              )
            END
          ) STORED, end_time time    , end_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN end_time IS NULL OR end_time = '' THEN NULL
              ELSE CAST(
                substr(end_time, 1, instr(end_time, ':') - 1) * 3600 +
                substr(end_time, instr(end_time, ':') + 1, 2) * 60 +
                substr(end_time, -2) AS INTEGER
              )
            END
          ) STORED, service_id text  NOT NULL  , PRIMARY KEY (timeframe_group_id, start_time, end_time, service_id));
CREATE TABLE timetable_notes (note_id text  NOT NULL  , symbol text    , note text  NOT NULL  COLLATE NOCASE, PRIMARY KEY (note_id));
CREATE TABLE timetable_notes_references (note_id text  NOT NULL  , timetable_id text    , route_id text    , trip_id text    , stop_id text    , stop_sequence integer CHECK((TYPEOF(stop_sequence) = 'integer' OR stop_sequence IS NULL))   , show_on_stoptime integer CHECK(show_on_stoptime >= 0 AND show_on_stoptime <= 1 AND (TYPEOF(show_on_stoptime) = 'integer' OR show_on_stoptime IS NULL))   , PRIMARY KEY (note_id, timetable_id, route_id, trip_id, stop_id, stop_sequence));
CREATE TABLE timetable_pages (timetable_page_id text  NOT NULL  , timetable_page_label text    , filename text    , PRIMARY KEY (timetable_page_id));
CREATE TABLE timetable_stop_order (timetable_id text  NOT NULL  , stop_id text  NOT NULL  , stop_sequence integer CHECK((TYPEOF(stop_sequence) = 'integer' OR stop_sequence IS NULL)) NOT NULL  , PRIMARY KEY (timetable_id, stop_id, stop_sequence));
CREATE TABLE timetables (timetable_id text  NOT NULL  , route_id text  NOT NULL  , direction_id integer CHECK(direction_id >= 0 AND direction_id <= 1 AND (TYPEOF(direction_id) = 'integer' OR direction_id IS NULL))   , start_date date    , end_date date    , monday integer CHECK(monday >= 0 AND monday <= 1 AND (TYPEOF(monday) = 'integer' OR monday IS NULL)) NOT NULL  , tuesday integer CHECK(tuesday >= 0 AND tuesday <= 1 AND (TYPEOF(tuesday) = 'integer' OR tuesday IS NULL)) NOT NULL  , wednesday integer CHECK(wednesday >= 0 AND wednesday <= 1 AND (TYPEOF(wednesday) = 'integer' OR wednesday IS NULL)) NOT NULL  , thursday integer CHECK(thursday >= 0 AND thursday <= 1 AND (TYPEOF(thursday) = 'integer' OR thursday IS NULL)) NOT NULL  , friday integer CHECK(friday >= 0 AND friday <= 1 AND (TYPEOF(friday) = 'integer' OR friday IS NULL)) NOT NULL  , saturday integer CHECK(saturday >= 0 AND saturday <= 1 AND (TYPEOF(saturday) = 'integer' OR saturday IS NULL)) NOT NULL  , sunday integer CHECK(sunday >= 0 AND sunday <= 1 AND (TYPEOF(sunday) = 'integer' OR sunday IS NULL)) NOT NULL  , start_time time    , start_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN start_time IS NULL OR start_time = '' THEN NULL
              ELSE CAST(
                substr(start_time, 1, instr(start_time, ':') - 1) * 3600 +
                substr(start_time, instr(start_time, ':') + 1, 2) * 60 +
                substr(start_time, -2) AS INTEGER
              )
            END
          ) STORED, end_time time    , end_timestamp INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN end_time IS NULL OR end_time = '' THEN NULL
              ELSE CAST(
                substr(end_time, 1, instr(end_time, ':') - 1) * 3600 +
                substr(end_time, instr(end_time, ':') + 1, 2) * 60 +
                substr(end_time, -2) AS INTEGER
              )
            END
          ) STORED, timetable_label text    COLLATE NOCASE, service_notes text    COLLATE NOCASE, orientation text    , timetable_page_id text    , timetable_sequence integer CHECK((TYPEOF(timetable_sequence) = 'integer' OR timetable_sequence IS NULL))   , direction_name text    , include_exceptions integer CHECK(include_exceptions >= 0 AND include_exceptions <= 1 AND (TYPEOF(include_exceptions) = 'integer' OR include_exceptions IS NULL))   , show_trip_continuation integer CHECK(show_trip_continuation >= 0 AND show_trip_continuation <= 1 AND (TYPEOF(show_trip_continuation) = 'integer' OR show_trip_continuation IS NULL))   , PRIMARY KEY (timetable_id, route_id));
CREATE TABLE train_cars (train_car_id text  NOT NULL  , model_name text    , facility_name text    , capacity_seated integer CHECK((TYPEOF(capacity_seated) = 'integer' OR capacity_seated IS NULL))   , capacity_wheelchair integer CHECK((TYPEOF(capacity_wheelchair) = 'integer' OR capacity_wheelchair IS NULL))   , capacity_bike integer CHECK((TYPEOF(capacity_bike) = 'integer' OR capacity_bike IS NULL))   , bike_rack text    , capacity_standing integer CHECK((TYPEOF(capacity_standing) = 'integer' OR capacity_standing IS NULL))   , train_car_type text    , PRIMARY KEY (train_car_id));
CREATE TABLE transfers (from_stop_id text    , to_stop_id text    , from_route_id text    , to_route_id text    , from_trip_id text    , to_trip_id text    , transfer_type integer CHECK(transfer_type >= 0 AND transfer_type <= 5 AND (TYPEOF(transfer_type) = 'integer' OR transfer_type IS NULL))   , min_transfer_time integer CHECK((TYPEOF(min_transfer_time) = 'integer' OR min_transfer_time IS NULL))   , PRIMARY KEY (from_stop_id, to_stop_id, from_route_id, to_route_id, from_trip_id, to_trip_id));
CREATE TABLE translations (table_name text  NOT NULL  , field_name text  NOT NULL  , language text  NOT NULL  , translation text  NOT NULL  , record_id text    , record_sub_id text    , field_value text    , PRIMARY KEY (table_name, field_name, language, record_id, record_sub_id, field_value));
CREATE TABLE trip_capacity (agency_id text    , trip_id text    , service_date date    , vehicle_description text    , seated_capacity integer CHECK((TYPEOF(seated_capacity) = 'integer' OR seated_capacity IS NULL))   , standing_capacity integer CHECK((TYPEOF(standing_capacity) = 'integer' OR standing_capacity IS NULL))   , wheelchair_capacity integer CHECK((TYPEOF(wheelchair_capacity) = 'integer' OR wheelchair_capacity IS NULL))   , bike_capacity integer CHECK((TYPEOF(bike_capacity) = 'integer' OR bike_capacity IS NULL))   );
CREATE TABLE trip_updates (id text  NOT NULL  , vehicle_id text    , trip_id text    , trip_start_time text    , direction_id integer CHECK((TYPEOF(direction_id) = 'integer' OR direction_id IS NULL))   , route_id text    , start_date text    , timestamp text    , schedule_relationship text    , created_timestamp integer CHECK((TYPEOF(created_timestamp) = 'integer' OR created_timestamp IS NULL)) NOT NULL  , expiration_timestamp integer CHECK((TYPEOF(expiration_timestamp) = 'integer' OR expiration_timestamp IS NULL)) NOT NULL  , PRIMARY KEY (id));
CREATE TABLE trips (route_id text  NOT NULL  , service_id text  NOT NULL  , trip_id text  NOT NULL  , trip_headsign text    COLLATE NOCASE, trip_short_name text    COLLATE NOCASE, direction_id integer CHECK(direction_id >= 0 AND direction_id <= 1 AND (TYPEOF(direction_id) = 'integer' OR direction_id IS NULL))   , block_id text    , shape_id text    , wheelchair_accessible integer CHECK(wheelchair_accessible >= 0 AND wheelchair_accessible <= 2 AND (TYPEOF(wheelchair_accessible) = 'integer' OR wheelchair_accessible IS NULL))   , bikes_allowed integer CHECK(bikes_allowed >= 0 AND bikes_allowed <= 2 AND (TYPEOF(bikes_allowed) = 'integer' OR bikes_allowed IS NULL))   , cars_allowed integer CHECK(cars_allowed >= 0 AND cars_allowed <= 2 AND (TYPEOF(cars_allowed) = 'integer' OR cars_allowed IS NULL))   , PRIMARY KEY (trip_id));
CREATE TABLE trips_dated_vehicle_journey (trip_id text  NOT NULL  , operating_day_date text  NOT NULL  , dated_vehicle_journey_gid text  NOT NULL  , journey_number integer CHECK(journey_number >= 0 AND journey_number <= 65535 AND (TYPEOF(journey_number) = 'integer' OR journey_number IS NULL))   );
CREATE TABLE trips_performed (service_date date  NOT NULL  , trip_id_performed text  NOT NULL  , vehicle_id text  NOT NULL  , trip_id_scheduled text    , route_id text    , route_type text    , ntd_mode text    , route_type_agency text    , shape_id text    , pattern_id text    , direction_id integer CHECK(direction_id >= 0 AND direction_id <= 1 AND (TYPEOF(direction_id) = 'integer' OR direction_id IS NULL))   , operator_id text    , block_id text    , trip_start_stop_id text    , trip_end_stop_id text    , schedule_trip_start text    , schedule_trip_end text    , actual_trip_start text    , actual_trip_end text    , trip_type text    , schedule_relationship text    , PRIMARY KEY (service_date, trip_id_performed));
CREATE TABLE vehicle_locations (location_ping_id text  NOT NULL  , service_date date    , event_timestamp text  NOT NULL  , trip_id_performed text    , trip_id_scheduled text    , trip_stop_sequence integer CHECK(trip_stop_sequence >= 1 AND (TYPEOF(trip_stop_sequence) = 'integer' OR trip_stop_sequence IS NULL))   , scheduled_stop_sequence integer CHECK((TYPEOF(scheduled_stop_sequence) = 'integer' OR scheduled_stop_sequence IS NULL))   , vehicle_id text  NOT NULL  , device_id text    , pattern_id text    , stop_id text    , current_status text    , latitude real CHECK(latitude >= -90 AND latitude <= 90 AND (TYPEOF(latitude) = 'real' OR latitude IS NULL))   , longitude real CHECK(longitude >= -180 AND longitude <= 180 AND (TYPEOF(longitude) = 'real' OR longitude IS NULL))   , gps_quality text    , heading real CHECK(heading >= 0 AND heading <= 360 AND (TYPEOF(heading) = 'real' OR heading IS NULL))   , speed real CHECK((TYPEOF(speed) = 'real' OR speed IS NULL))   , odometer real CHECK((TYPEOF(odometer) = 'real' OR odometer IS NULL))   , schedule_deviation integer CHECK((TYPEOF(schedule_deviation) = 'integer' OR schedule_deviation IS NULL))   , headway_deviation integer CHECK((TYPEOF(headway_deviation) = 'integer' OR headway_deviation IS NULL))   , trip_type text    , schedule_relationship text    , PRIMARY KEY (location_ping_id));
CREATE TABLE vehicle_positions (id text  NOT NULL  , bearing real CHECK((TYPEOF(bearing) = 'real' OR bearing IS NULL))   , latitude real CHECK(latitude >= -90 AND latitude <= 90 AND (TYPEOF(latitude) = 'real' OR latitude IS NULL))   , longitude real CHECK(longitude >= -180 AND longitude <= 180 AND (TYPEOF(longitude) = 'real' OR longitude IS NULL))   , speed real CHECK((TYPEOF(speed) = 'real' OR speed IS NULL))   , current_stop_sequence integer CHECK((TYPEOF(current_stop_sequence) = 'integer' OR current_stop_sequence IS NULL))   , trip_id text    , trip_start_date text    , trip_start_time text    , congestion_level text    , occupancy_status text    , occupancy_percentage integer CHECK((TYPEOF(occupancy_percentage) = 'integer' OR occupancy_percentage IS NULL))   , vehicle_stop_status text    , vehicle_id text    , vehicle_label text    , vehicle_license_plate text    , vehicle_wheelchair_accessible text    , timestamp text    , created_timestamp integer CHECK((TYPEOF(created_timestamp) = 'integer' OR created_timestamp IS NULL)) NOT NULL  , expiration_timestamp integer CHECK((TYPEOF(expiration_timestamp) = 'integer' OR expiration_timestamp IS NULL)) NOT NULL  , PRIMARY KEY (id));
CREATE TABLE vehicle_train_cars (vehicle_id text  NOT NULL  , train_car_id text  NOT NULL  , train_car_order integer CHECK((TYPEOF(train_car_order) = 'integer' OR train_car_order IS NULL))   , operator_id text    , PRIMARY KEY (vehicle_id, train_car_id));
CREATE TABLE vehicles (vehicle_id text  NOT NULL  , vehicle_start text    , vehicle_end text    , model_name text    , facility_name text    , capacity_seated integer CHECK((TYPEOF(capacity_seated) = 'integer' OR capacity_seated IS NULL))   , capacity_wheelchair integer CHECK((TYPEOF(capacity_wheelchair) = 'integer' OR capacity_wheelchair IS NULL))   , capacity_bike integer CHECK((TYPEOF(capacity_bike) = 'integer' OR capacity_bike IS NULL))   , bike_rack text    , capacity_standing integer CHECK((TYPEOF(capacity_standing) = 'integer' OR capacity_standing IS NULL))   , PRIMARY KEY (vehicle_id));
CREATE INDEX idx_board_alight_trip_id ON board_alight (trip_id);
CREATE INDEX idx_board_alight_stop_id ON board_alight (stop_id);
CREATE INDEX idx_board_alight_stop_sequence ON board_alight (stop_sequence);
CREATE INDEX idx_board_alight_record_use ON board_alight (record_use);
CREATE INDEX idx_board_alight_service_date ON board_alight (service_date);
CREATE INDEX idx_board_alight_service_arrival_timestamp ON board_alight (service_arrival_timestamp);
CREATE INDEX idx_board_alight_service_departure_timestamp ON board_alight (service_departure_timestamp);
CREATE INDEX idx_booking_rules_prior_notice_last_timestamp ON booking_rules (prior_notice_last_timestamp);
CREATE INDEX idx_booking_rules_prior_notice_start_timestamp ON booking_rules (prior_notice_start_timestamp);
CREATE INDEX idx_calendar_start_date ON calendar (start_date);
CREATE INDEX idx_calendar_end_date ON calendar (end_date);
CREATE INDEX idx_calendar_dates_exception_type ON calendar_dates (exception_type);
CREATE INDEX idx_deadhead_times_deadhead_id ON deadhead_times (deadhead_id);
CREATE INDEX idx_deadhead_times_arrival_timestamp ON deadhead_times (arrival_timestamp);
CREATE INDEX idx_deadhead_times_departure_timestamp ON deadhead_times (departure_timestamp);
CREATE INDEX idx_deadhead_times_location_sequence ON deadhead_times (location_sequence);
CREATE INDEX idx_deadheads_block_id ON deadheads (block_id);
CREATE INDEX idx_deadheads_shape_id ON deadheads (shape_id);
CREATE INDEX idx_deadheads_to_trip_id ON deadheads (to_trip_id);
CREATE INDEX idx_deadheads_from_trip_id ON deadheads (from_trip_id);
CREATE INDEX idx_deadheads_to_deadhead_id ON deadheads (to_deadhead_id);
CREATE INDEX idx_deadheads_from_deadhead_id ON deadheads (from_deadhead_id);
CREATE INDEX idx_fare_transactions_transaction_id ON fare_transactions (transaction_id);
CREATE INDEX idx_frequencies_start_timestamp ON frequencies (start_timestamp);
CREATE INDEX idx_frequencies_end_timestamp ON frequencies (end_timestamp);
CREATE INDEX idx_location_group_stops_location_group_id ON location_group_stops (location_group_id);
CREATE INDEX idx_location_group_stops_stop_id ON location_group_stops (stop_id);
CREATE INDEX idx_passenger_events_passenger_event_id ON passenger_events (passenger_event_id);
CREATE INDEX idx_ride_feed_info_ride_start_date ON ride_feed_info (ride_start_date);
CREATE INDEX idx_ride_feed_info_ride_end_date ON ride_feed_info (ride_end_date);
CREATE INDEX idx_ride_feed_info_gtfs_feed_date ON ride_feed_info (gtfs_feed_date);
CREATE INDEX idx_rider_trip_agency_id ON rider_trip (agency_id);
CREATE INDEX idx_rider_trip_trip_id ON rider_trip (trip_id);
CREATE INDEX idx_rider_trip_boarding_stop_id ON rider_trip (boarding_stop_id);
CREATE INDEX idx_rider_trip_boarding_stop_sequence ON rider_trip (boarding_stop_sequence);
CREATE INDEX idx_rider_trip_alighting_stop_id ON rider_trip (alighting_stop_id);
CREATE INDEX idx_rider_trip_alighting_stop_sequence ON rider_trip (alighting_stop_sequence);
CREATE INDEX idx_rider_trip_service_date ON rider_trip (service_date);
CREATE INDEX idx_rider_trip_boarding_timestamp ON rider_trip (boarding_timestamp);
CREATE INDEX idx_rider_trip_alighting_timestamp ON rider_trip (alighting_timestamp);
CREATE INDEX idx_ridership_ridership_start_date ON ridership (ridership_start_date);
CREATE INDEX idx_ridership_ridership_end_date ON ridership (ridership_end_date);
CREATE INDEX idx_ridership_ridership_start_timestamp ON ridership (ridership_start_timestamp);
CREATE INDEX idx_ridership_ridership_end_timestamp ON ridership (ridership_end_timestamp);
CREATE INDEX idx_ridership_service_id ON ridership (service_id);
CREATE INDEX idx_ridership_agency_id ON ridership (agency_id);
CREATE INDEX idx_ridership_route_id ON ridership (route_id);
CREATE INDEX idx_ridership_direction_id ON ridership (direction_id);
CREATE INDEX idx_route_networks_route_id ON route_networks (route_id);
CREATE INDEX idx_run_event_event_type ON run_event (event_type);
CREATE INDEX idx_run_event_event_from_location_type ON run_event (event_from_location_type);
CREATE INDEX idx_run_event_event_to_location_type ON run_event (event_to_location_type);
CREATE INDEX idx_runs_pieces_start_type ON runs_pieces (start_type);
CREATE INDEX idx_runs_pieces_start_trip_id ON runs_pieces (start_trip_id);
CREATE INDEX idx_runs_pieces_end_type ON runs_pieces (end_type);
CREATE INDEX idx_runs_pieces_end_trip_id ON runs_pieces (end_trip_id);
CREATE INDEX idx_service_alert_informed_entities_stop_id ON service_alert_informed_entities (stop_id);
CREATE INDEX idx_service_alert_informed_entities_route_id ON service_alert_informed_entities (route_id);
CREATE INDEX idx_service_alert_informed_entities_route_type ON service_alert_informed_entities (route_type);
CREATE INDEX idx_service_alert_informed_entities_trip_id ON service_alert_informed_entities (trip_id);
CREATE INDEX idx_service_alert_informed_entities_direction_id ON service_alert_informed_entities (direction_id);
CREATE INDEX idx_service_alerts_id ON service_alerts (id);
CREATE INDEX idx_stop_time_updates_trip_id ON stop_time_updates (trip_id);
CREATE INDEX idx_stop_time_updates_route_id ON stop_time_updates (route_id);
CREATE INDEX idx_stop_time_updates_stop_id ON stop_time_updates (stop_id);
CREATE INDEX idx_stop_times_arrival_timestamp ON stop_times (arrival_timestamp);
CREATE INDEX idx_stop_times_departure_timestamp ON stop_times (departure_timestamp);
CREATE INDEX idx_stop_times_location_group_id ON stop_times (location_group_id);
CREATE INDEX idx_stop_times_location_id ON stop_times (location_id);
CREATE INDEX idx_stop_times_stop_id ON stop_times (stop_id);
CREATE INDEX idx_stop_times_start_pickup_drop_off_window_timestamp ON stop_times (start_pickup_drop_off_window_timestamp);
CREATE INDEX idx_stop_times_pickup_booking_rule_id ON stop_times (pickup_booking_rule_id);
CREATE INDEX idx_stop_times_drop_off_booking_rule_id ON stop_times (drop_off_booking_rule_id);
CREATE INDEX idx_stops_parent_station ON stops (parent_station);
CREATE INDEX idx_stops_name_fold ON stops(stop_name_fold) WHERE location_type=1;
CREATE INDEX idx_timeframes_start_timestamp ON timeframes (start_timestamp);
CREATE INDEX idx_timeframes_end_timestamp ON timeframes (end_timestamp);
CREATE INDEX idx_timeframes_service_id ON timeframes (service_id);
CREATE INDEX idx_timetable_stop_order_timetable_id ON timetable_stop_order (timetable_id);
CREATE INDEX idx_timetable_stop_order_stop_sequence ON timetable_stop_order (stop_sequence);
CREATE INDEX idx_timetables_start_timestamp ON timetables (start_timestamp);
CREATE INDEX idx_timetables_end_timestamp ON timetables (end_timestamp);
CREATE INDEX idx_timetables_timetable_sequence ON timetables (timetable_sequence);
CREATE INDEX idx_trip_capacity_agency_id ON trip_capacity (agency_id);
CREATE INDEX idx_trip_capacity_trip_id ON trip_capacity (trip_id);
CREATE INDEX idx_trip_capacity_service_date ON trip_capacity (service_date);
CREATE INDEX idx_trip_updates_id ON trip_updates (id);
CREATE INDEX idx_trip_updates_vehicle_id ON trip_updates (vehicle_id);
CREATE INDEX idx_trip_updates_trip_id ON trip_updates (trip_id);
CREATE INDEX idx_trip_updates_route_id ON trip_updates (route_id);
CREATE INDEX idx_trips_route_id ON trips (route_id);
CREATE INDEX idx_trips_service_id ON trips (service_id);
CREATE INDEX idx_trips_direction_id ON trips (direction_id);
CREATE INDEX idx_trips_block_id ON trips (block_id);
CREATE INDEX idx_trips_shape_id ON trips (shape_id);
CREATE INDEX idx_trips_dated_vehicle_journey_trip_id ON trips_dated_vehicle_journey (trip_id);
CREATE INDEX idx_trips_dated_vehicle_journey_operating_day_date ON trips_dated_vehicle_journey (operating_day_date);
CREATE INDEX idx_trips_dated_vehicle_journey_journey_number ON trips_dated_vehicle_journey (journey_number);
CREATE INDEX idx_vehicle_positions_id ON vehicle_positions (id);
CREATE INDEX idx_vehicle_positions_trip_id ON vehicle_positions (trip_id);
CREATE INDEX idx_vehicle_positions_trip_start_date ON vehicle_positions (trip_start_date);
CREATE INDEX idx_vehicle_positions_trip_start_time ON vehicle_positions (trip_start_time);
CREATE INDEX idx_vehicle_positions_vehicle_id ON vehicle_positions (vehicle_id);
