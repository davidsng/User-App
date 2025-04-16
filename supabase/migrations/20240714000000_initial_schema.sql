--
-- PostgreSQL database dump (cleaned for Supabase compatibility)
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';
SET default_table_access_method = heap;

--
-- Name: companies; Type: TABLE; Schema: public
--

CREATE TABLE public.companies (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    industry_vertical character varying(255),
    sub_industry character varying(255),
    b2b_or_b2c character varying(50),
    size character varying(100),
    website_url character varying(255),
    country_hq character varying(100),
    other_countries text[],
    revenue numeric(15,2),
    employee_size integer,
    child_companies text[],
    customer_segment_label character varying(100),
    primary_contact character varying(255),
    account_team text[],
    company_hierarchy text,
    decision_country character varying(100),
    company_address text,
    company_legal_entity character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone,
    change_history jsonb DEFAULT '[]'::jsonb
);

--
-- Name: contacts; Type: TABLE; Schema: public
--

CREATE TABLE public.contacts (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(100),
    title character varying(255),
    influence_role character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone,
    change_history jsonb DEFAULT '[]'::jsonb,
    is_primary boolean DEFAULT false,
    company_name character varying(255)
);

--
-- Name: COLUMN contacts.is_primary; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.contacts.is_primary IS 'Indicates if this is the primary contact for the company';

--
-- Name: COLUMN contacts.company_name; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.contacts.company_name IS 'Name of the company this contact belongs to, denormalized for reporting';

--
-- Name: customer_updates; Type: TABLE; Schema: public
--

CREATE TABLE public.customer_updates (
    id uuid NOT NULL,
    company_id uuid,
    update_type character varying(50) NOT NULL,
    user_id character varying(100),
    user_name character varying(255),
    source character varying(255),
    raw_input text,
    structured_data jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: deals; Type: TABLE; Schema: public
--

CREATE TABLE public.deals (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    product_id uuid,
    deal_id character varying(255),
    deal_state character varying(100),
    deal_amount numeric(15,2),
    deal_amount_currency character varying(10) DEFAULT 'USD'::character varying,
    stage character varying(100),
    deal_payment_status character varying(100),
    deal_start_date date,
    deal_end_date date,
    deal_policy_state character varying(100),
    deal_health integer,
    payment_frequency character varying(100),
    acquisition_channel_source character varying(255),
    acquisition_campaign_source character varying(255),
    deal_activity text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    change_history jsonb DEFAULT '[]'::jsonb,
    deal_expected_signing_date date,
    deal_signing_date date,
    company_name character varying(255),
    product_name character varying(255)
);

--
-- Name: COLUMN deals.deal_expected_signing_date; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.deals.deal_expected_signing_date IS 'Expected date when the deal will be signed';

--
-- Name: COLUMN deals.deal_signing_date; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.deals.deal_signing_date IS 'Actual date when the deal was signed';

--
-- Name: COLUMN deals.company_name; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.deals.company_name IS 'Denormalized company name for easier querying and reporting';

--
-- Name: COLUMN deals.product_name; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.deals.product_name IS 'Denormalized product name for easier querying and reporting';

--
-- Name: migrations; Type: TABLE; Schema: public
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    applied_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;

--
-- Name: products; Type: TABLE; Schema: public
--

CREATE TABLE public.products (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);

--
-- Name: user_prompt_logs; Type: TABLE; Schema: public
--

CREATE TABLE public.user_prompt_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    interaction_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    interaction_type character varying(50),
    interaction_data jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    contact_id uuid,
    deal_id uuid,
    raw_input text,
    employee_id uuid,
    employee_name character varying(255)
);

--
-- Name: TABLE user_prompt_logs; Type: COMMENT; Schema: public
--

COMMENT ON TABLE public.user_prompt_logs IS 'Stores logs of all raw user input and conversations';

--
-- Name: COLUMN user_prompt_logs.company_id; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.user_prompt_logs.company_id IS 'Reference to the company';

--
-- Name: COLUMN user_prompt_logs.interaction_type; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.user_prompt_logs.interaction_type IS 'Type of interaction (e.g., call, email, meeting)';

--
-- Name: COLUMN user_prompt_logs.interaction_data; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.user_prompt_logs.interaction_data IS 'JSON data containing the details of the interaction';

--
-- Name: COLUMN user_prompt_logs.contact_id; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.user_prompt_logs.contact_id IS 'Reference to the contact person';

--
-- Name: COLUMN user_prompt_logs.deal_id; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.user_prompt_logs.deal_id IS 'Reference to the associated deal';

--
-- Name: COLUMN user_prompt_logs.raw_input; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.user_prompt_logs.raw_input IS 'Original raw text input from the user';

--
-- Name: COLUMN user_prompt_logs.employee_id; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.user_prompt_logs.employee_id IS 'ID of the employee who recorded this input';

--
-- Name: COLUMN user_prompt_logs.employee_name; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.user_prompt_logs.employee_name IS 'Name of the employee who recorded this input';

--
-- Name: migrations id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);

--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);

--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);

--
-- Name: user_prompt_logs customer_data_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.user_prompt_logs
    ADD CONSTRAINT customer_data_pkey PRIMARY KEY (id);

--
-- Name: customer_updates customer_updates_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.customer_updates
    ADD CONSTRAINT customer_updates_pkey PRIMARY KEY (id);

--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);

--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);

--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);

--
-- Name: products products_name_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_name_key UNIQUE (name);

--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

--
-- Name: idx_company_country; Type: INDEX; Schema: public
--

CREATE INDEX idx_company_country ON public.companies USING btree (country_hq);

--
-- Name: idx_company_industry; Type: INDEX; Schema: public
--

CREATE INDEX idx_company_industry ON public.companies USING btree (industry_vertical);

--
-- Name: idx_company_name; Type: INDEX; Schema: public
--

CREATE INDEX idx_company_name ON public.companies USING btree (name);

--
-- Name: idx_contacts_company_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_contacts_company_id ON public.contacts USING btree (company_id);

--
-- Name: idx_contacts_company_name; Type: INDEX; Schema: public
--

CREATE INDEX idx_contacts_company_name ON public.contacts USING btree (company_name);

--
-- Name: idx_contacts_is_primary; Type: INDEX; Schema: public
--

CREATE INDEX idx_contacts_is_primary ON public.contacts USING btree (is_primary);

--
-- Name: idx_customer_data_company_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_customer_data_company_id ON public.user_prompt_logs USING btree (company_id);

--
-- Name: idx_customer_data_contact_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_customer_data_contact_id ON public.user_prompt_logs USING btree (contact_id);

--
-- Name: idx_customer_data_deal_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_customer_data_deal_id ON public.user_prompt_logs USING btree (deal_id);

--
-- Name: idx_customer_data_interaction_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_customer_data_interaction_date ON public.user_prompt_logs USING btree (interaction_date);

--
-- Name: idx_deals_company_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_company_id ON public.deals USING btree (company_id);

--
-- Name: idx_deals_expected_signing_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_expected_signing_date ON public.deals USING btree (deal_expected_signing_date);

--
-- Name: idx_deals_signing_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_signing_date ON public.deals USING btree (deal_signing_date);

--
-- Name: idx_deals_stage; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_stage ON public.deals USING btree (stage);

--
-- Name: idx_interaction_logs_employee_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_interaction_logs_employee_id ON public.user_prompt_logs USING btree (employee_id);

--
-- Name: idx_user_prompt_logs_company_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_user_prompt_logs_company_id ON public.user_prompt_logs USING btree (company_id);

--
-- Name: idx_user_prompt_logs_contact_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_user_prompt_logs_contact_id ON public.user_prompt_logs USING btree (contact_id);

--
-- Name: idx_user_prompt_logs_deal_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_user_prompt_logs_deal_id ON public.user_prompt_logs USING btree (deal_id);

--
-- Name: idx_user_prompt_logs_employee_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_user_prompt_logs_employee_id ON public.user_prompt_logs USING btree (employee_id);

--
-- Name: idx_user_prompt_logs_interaction_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_user_prompt_logs_interaction_date ON public.user_prompt_logs USING btree (interaction_date);

--
-- Name: contacts contacts_company_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

--
-- Name: user_prompt_logs customer_data_company_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.user_prompt_logs
    ADD CONSTRAINT customer_data_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

--
-- Name: user_prompt_logs customer_data_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.user_prompt_logs
    ADD CONSTRAINT customer_data_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);

--
-- Name: user_prompt_logs customer_data_deal_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.user_prompt_logs
    ADD CONSTRAINT customer_data_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id);

--
-- Name: customer_updates customer_updates_company_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.customer_updates
    ADD CONSTRAINT customer_updates_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

--
-- Name: deals deals_company_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

--
-- Name: deals deals_product_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

--
-- PostgreSQL database dump complete
--

