
CREATE TABLE agent
(
	agent_id SERIAL PRIMARY KEY,
	display_name VARCHAR(32) NOT NULL
);

CREATE TABLE account_status
(
	account_status_id VARCHAR(32) PRIMARY KEY
);
INSERT INTO account_status (account_status_id) VALUES ('active'),('deactivated'),('locked'),('banned'),('purged');

CREATE TABLE account
(
	account_id SERIAL PRIMARY KEY,
	create_datetime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	email VARCHAR(191) NOT NULL UNIQUE,
	first_name VARCHAR(191),
	last_name VARCHAR(191),
	account_status_id VARCHAR(32) NOT NULL DEFAULT 'active',
	is_email_verified BOOLEAN NOT NULL DEFAULT true,
	is_risk_verified BOOLEAN NOT NULL DEFAULT true,
	marketing_consent BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE account_action
(
	account_action_id VARCHAR(32) PRIMARY KEY
);
INSERT INTO account_action (account_action_id) VALUES 
('created'),('updated'),('deactivated'),('reactivated'),('banned'),('purged'),('locked'),('unlocked'),('note_added'),
('login'),('logout'),('marketing_consent_given'),('marketing_consent_revoked'),('email_verified'),('risk_verified'),
('address_added'),('address_deactivated'),('address_reactivated'),('address_banned'),('address_purged'),('address_updated');

CREATE TABLE account_history
(
	account_history_id SERIAL PRIMARY KEY,
	create_datetime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	account_id INT NOT NULL,
	agent_id INT NOT NULL,
	account_action_id VARCHAR(32) NOT NULL,
	notes text,

	FOREIGN KEY (account_id) REFERENCES account (account_id),
	FOREIGN KEY (agent_id) REFERENCES agent (agent_id)
);

CREATE TABLE account_session
(
	session_key VARCHAR(191) PRIMARY KEY,
	create_datetime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	account_id INT NOT NULL,
	verify_code VARCHAR(191) NOT NULL,
	manual_code VARCHAR(191) NOT NULL,

	FOREIGN KEY (account_id) REFERENCES account (account_id) ON UPDATE CASCADE
);


CREATE TABLE awgr_type 
(
	awgr_type_id VARCHAR(8) PRIMARY KEY
);
INSERT INTO awgr_type VALUES ('account'),('program');

CREATE TABLE awgr
(
	awgr_id SERIAL PRIMARY KEY,
	awgr_type_id VARCHAR(8) NOT NULL,
	account_id INT, -- null account ID means the awgr is an npc
	quid INT NOT NULL,
	denari INT NOT NULL,
	honor INT NOT NULL,

	FOREIGN KEY (account_id) REFERENCES account (account_id),
	FOREIGN KEY (awgr_type_id) REFERENCES awgr_type (awgr_type_id)
);


CREATE TABLE currency (
	currency_id VARCHAR(16) PRIMARY KEY
);
INSERT INTO currency (currency_id) VALUES ('denari'),('quid'),('honor');


CREATE TABLE prediction_side (
	prediction_side_id VARCHAR(8) PRIMARY KEY
);
INSERT INTO prediction_side (prediction_side_id) VALUES ('agree'),('dissent');

CREATE TABLE prediction_set
(
	prediction_set_id SERIAL PRIMARY KEY,
	created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	set_fulfillment_ts TIMESTAMP NOT NULL,
	quid_per_denari INT NOT NULL DEFAULT 10, -- we set the exchange rate per set, and 10 quid = 1 denari, when converting, we'll round
	vig_pct INT NOT NULL DEFAULT 0
);


CREATE TABLE prediction (
	prediction_id SERIAL PRIMARY KEY,
	prediction_set_id INT NOT NULL,
	created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	display_name VARCHAR(256) NOT NULL,
	description TEXT,
	fulfillment_ts TIMESTAMP, -- can overwrite the set level ts,
	came_true BOOLEAN,

	FOREIGN KEY ( prediction_set_id ) REFERENCES prediction_set ( prediction_set_id )
);


CREATE TABLE prediction_contract (
	prediction_contract_id SERIAL PRIMARY KEY,
	prediction_id INT NOT NULL,
	prediction_side_id VARCHAR(8) NOT NULL,

	FOREIGN KEY ( prediction_id ) REFERENCES prediction ( prediction_id ),
	FOREIGN KEY ( prediction_side_id ) REFERENCES prediction_side ( prediction_side_id )
);

CREATE TABLE order_type
(
	order_type_id VARCHAR(8) PRIMARY KEY
);
INSERT INTO order_type (order_type_id) VALUES ('market'),('limit'),('stop'); --('trail_stop'),('time_stop');

CREATE TABLE contract_action
(
	contract_action_id VARCHAR(8) PRIMARY KEY
);
INSERT INTO contract_action (contract_action_id) VALUES ('buy'),('sell');

CREATE TABLE contract_order
(
	contract_order_id SERIAL PRIMARY KEY,
	awgr_id INT NOT NULL,
	prediction_contract_id INT NOT NULL,
	order_type_id VARCHAR(8) NOT NULL,
	contract_action_id VARCHAR(8) NOT NULL,
	order_price_quid INT,
	order_quantity INT NOT NULL,
	created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	activated_ts TIMESTAMP NOT NULL,
	filled_ts TIMESTAMP NOT NULL,
	cancelled_ts TIMESTAMP NOT NULL,

	FOREIGN KEY ( awgr_id ) REFERENCES awgr ( awgr_id ),
	FOREIGN KEY ( prediction_contract_id ) REFERENCES prediction_contract ( prediction_contract_id ),
	FOREIGN KEY ( order_type_id ) REFERENCES order_type ( order_type_id ),
	FOREIGN KEY ( contract_action_id ) REFERENCES contract_action ( contract_action_id )
);

CREATE TABLE fill
(
	fill_id SERIAL PRIMARY KEY,
	contract_order_id INT NOT NULL,
	fill_price_quid INT NOT NULL,
	fill_quantity INT NOT NULL,
	created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fill_to_fill
(
	fill_to_fill_id SERIAL PRIMARY KEY,
	buy_fill_id INT NOT NULL,
	sell_fill_id INT NOT NULL,
	fill_quantity INT NOT NULL,
	net_oi_change INT NOT NULL,

	FOREIGN KEY ( buy_fill_id ) REFERENCES fill ( fill_id ),
	FOREIGN KEY ( sell_fill_id ) REFERENCES fill ( fill_id )
);

-- keeps track of what people own
CREATE TABLE awgr_contract
(
	awgr_contract_id INT PRIMARY KEY,
	awgr_id INT NOT NULL,
	prediction_contract_id INT NOT NULL,
	quantity INT
);





