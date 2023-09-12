--
-- PostgreSQL database dump
--

-- Dumped from database version 14.9 (Ubuntu 14.9-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.9 (Ubuntu 14.9-0ubuntu0.22.04.1)

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
-- Name: Agencies; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public."Agencies" (
    id integer NOT NULL,
    agency character varying,
    acronym character varying,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone
);


ALTER TABLE public."Agencies" OWNER TO circleci;

--
-- Name: Agencies_id_seq; Type: SEQUENCE; Schema: public; Owner: circleci
--

CREATE SEQUENCE public."Agencies_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Agencies_id_seq" OWNER TO circleci;

--
-- Name: Agencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: circleci
--

ALTER SEQUENCE public."Agencies_id_seq" OWNED BY public."Agencies".id;


--
-- Name: Predictions; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public."Predictions" (
    id integer NOT NULL,
    title character varying NOT NULL,
    url character varying,
    agency character varying,
    "numDocs" integer,
    "solNum" character varying NOT NULL,
    "noticeType" character varying NOT NULL,
    date timestamp without time zone,
    office character varying,
    na_flag boolean,
    "eitLikelihood" jsonb,
    undetermined boolean,
    action jsonb,
    "actionStatus" character varying,
    "actionDate" timestamp without time zone,
    feedback jsonb,
    history jsonb,
    "contactInfo" jsonb,
    "parseStatus" jsonb,
    predictions jsonb,
    "reviewRec" character varying,
    "searchText" character varying,
    "createdAt" timestamp without time zone,
    "updatedAt" timestamp without time zone
);


ALTER TABLE public."Predictions" OWNER TO circleci;

--
-- Name: Predictions_id_seq; Type: SEQUENCE; Schema: public; Owner: circleci
--

CREATE SEQUENCE public."Predictions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Predictions_id_seq" OWNER TO circleci;

--
-- Name: Predictions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: circleci
--

ALTER SEQUENCE public."Predictions_id_seq" OWNED BY public."Predictions".id;


--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


ALTER TABLE public."SequelizeMeta" OWNER TO circleci;

--
-- Name: Surveys; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public."Surveys" (
    id integer NOT NULL,
    question text,
    choices jsonb,
    section character varying(2000),
    type character varying(2000),
    answer text,
    note text,
    "choicesNote" jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone
);


ALTER TABLE public."Surveys" OWNER TO circleci;

--
-- Name: Surveys_id_seq; Type: SEQUENCE; Schema: public; Owner: circleci
--

CREATE SEQUENCE public."Surveys_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Surveys_id_seq" OWNER TO circleci;

--
-- Name: Surveys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: circleci
--

ALTER SEQUENCE public."Surveys_id_seq" OWNED BY public."Surveys".id;


--
-- Name: Users; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public."Users" (
    id integer NOT NULL,
    "firstName" character varying,
    "lastName" character varying,
    agency character varying,
    email character varying,
    password character varying,
    "position" character varying,
    "isAccepted" boolean,
    "isRejected" boolean,
    "userRole" character varying,
    "rejectionNote" character varying,
    "creationDate" character varying,
    "tempPassword" character varying,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone,
    "maxId" character varying(256)
);


ALTER TABLE public."Users" OWNER TO circleci;

--
-- Name: Users_id_seq; Type: SEQUENCE; Schema: public; Owner: circleci
--

CREATE SEQUENCE public."Users_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Users_id_seq" OWNER TO circleci;

--
-- Name: Users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: circleci
--

ALTER SEQUENCE public."Users_id_seq" OWNED BY public."Users".id;


--
-- Name: agency_alias; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public.agency_alias (
    id integer NOT NULL,
    agency_id integer NOT NULL,
    alias character varying,
    "createdAt" timestamp without time zone,
    "updatedAt" timestamp without time zone
);


ALTER TABLE public.agency_alias OWNER TO circleci;

--
-- Name: agency_alias_id_seq; Type: SEQUENCE; Schema: public; Owner: circleci
--

CREATE SEQUENCE public.agency_alias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.agency_alias_id_seq OWNER TO circleci;

--
-- Name: agency_alias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: circleci
--

ALTER SEQUENCE public.agency_alias_id_seq OWNED BY public.agency_alias.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO circleci;

--
-- Name: attachment; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public.attachment (
    id integer NOT NULL,
    notice_id integer,
    notice_type_id integer,
    filename text NOT NULL,
    machine_readable boolean,
    attachment_text text,
    prediction integer,
    decision_boundary double precision,
    validation integer,
    attachment_url text,
    trained boolean,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone,
    solicitation_id integer
);


ALTER TABLE public.attachment OWNER TO circleci;

--
-- Name: attachment_id_seq; Type: SEQUENCE; Schema: public; Owner: circleci
--

CREATE SEQUENCE public.attachment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.attachment_id_seq OWNER TO circleci;

--
-- Name: attachment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: circleci
--

ALTER SEQUENCE public.attachment_id_seq OWNED BY public.attachment.id;


--
-- Name: model; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public.model (
    id integer NOT NULL,
    results jsonb,
    params jsonb,
    score double precision,
    create_date timestamp without time zone NOT NULL
);


ALTER TABLE public.model OWNER TO circleci;

--
-- Name: model_id_seq; Type: SEQUENCE; Schema: public; Owner: circleci
--

CREATE SEQUENCE public.model_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.model_id_seq OWNER TO circleci;

--
-- Name: model_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: circleci
--

ALTER SEQUENCE public.model_id_seq OWNED BY public.model.id;


--
-- Name: notice; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public.notice (
    id integer NOT NULL,
    notice_type_id integer,
    solicitation_number character varying(150),
    agency character varying(150),
    date timestamp without time zone,
    notice_data jsonb,
    compliant integer,
    feedback jsonb,
    history jsonb,
    action jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone,
    na_flag boolean
);


ALTER TABLE public.notice OWNER TO circleci;

--
-- Name: notice_id_seq; Type: SEQUENCE; Schema: public; Owner: circleci
--

CREATE SEQUENCE public.notice_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notice_id_seq OWNER TO circleci;

--
-- Name: notice_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: circleci
--

ALTER SEQUENCE public.notice_id_seq OWNED BY public.notice.id;


--
-- Name: notice_type; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public.notice_type (
    id integer NOT NULL,
    notice_type character varying(50),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);


ALTER TABLE public.notice_type OWNER TO circleci;

--
-- Name: notice_type_id_seq; Type: SEQUENCE; Schema: public; Owner: circleci
--

CREATE SEQUENCE public.notice_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notice_type_id_seq OWNER TO circleci;

--
-- Name: notice_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: circleci
--

ALTER SEQUENCE public.notice_type_id_seq OWNED BY public.notice_type.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO circleci;

--
-- Name: solicitations; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public.solicitations (
    id integer NOT NULL,
    "solNum" character varying,
    active boolean DEFAULT true,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone,
    title character varying,
    url character varying,
    agency character varying,
    agency_id integer,
    "numDocs" integer,
    notice_type_id integer,
    "noticeType" character varying,
    date timestamp without time zone,
    office character varying,
    na_flag boolean DEFAULT false,
    category_list jsonb,
    undetermined boolean,
    history jsonb DEFAULT '[]'::jsonb,
    action jsonb DEFAULT '[]'::jsonb,
    "actionStatus" character varying,
    "actionDate" timestamp without time zone,
    "contactInfo" jsonb,
    "parseStatus" jsonb,
    predictions jsonb DEFAULT '{"value": "red", "history": []}'::jsonb,
    "reviewRec" character varying,
    "searchText" character varying,
    compliant integer DEFAULT 0,
    "noticeData" jsonb
);


ALTER TABLE public.solicitations OWNER TO circleci;

--
-- Name: solicitations_id_seq; Type: SEQUENCE; Schema: public; Owner: circleci
--

CREATE SEQUENCE public.solicitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.solicitations_id_seq OWNER TO circleci;

--
-- Name: solicitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: circleci
--

ALTER SEQUENCE public.solicitations_id_seq OWNED BY public.solicitations.id;


--
-- Name: survey_backup; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public.survey_backup (
    id integer,
    question text,
    choices jsonb,
    section character varying(2000),
    type character varying(2000),
    answer text,
    note text,
    "choicesNote" jsonb,
    "createdAt" timestamp without time zone,
    "updatedAt" timestamp without time zone
);


ALTER TABLE public.survey_backup OWNER TO circleci;

--
-- Name: survey_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: circleci
--

CREATE SEQUENCE public.survey_responses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.survey_responses_id_seq OWNER TO circleci;

--
-- Name: survey_responses; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public.survey_responses (
    id integer DEFAULT nextval('public.survey_responses_id_seq'::regclass) NOT NULL,
    "solNum" character varying,
    contemporary_notice_id integer,
    response jsonb DEFAULT '[]'::jsonb,
    "maxId" character varying(256),
    "updatedAt" timestamp without time zone DEFAULT now(),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.survey_responses OWNER TO circleci;

--
-- Name: survey_responses_archive; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public.survey_responses_archive (
    id integer NOT NULL,
    "solNum" character varying(255),
    "maxId" character varying(255),
    contemporary_notice_id integer,
    response jsonb DEFAULT '[]'::jsonb,
    original_created_at timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone
);


ALTER TABLE public.survey_responses_archive OWNER TO circleci;

--
-- Name: survey_responses_archive_id_seq; Type: SEQUENCE; Schema: public; Owner: circleci
--

CREATE SEQUENCE public.survey_responses_archive_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.survey_responses_archive_id_seq OWNER TO circleci;

--
-- Name: survey_responses_archive_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: circleci
--

ALTER SEQUENCE public.survey_responses_archive_id_seq OWNED BY public.survey_responses_archive.id;


--
-- Name: winston_logs; Type: TABLE; Schema: public; Owner: circleci
--

CREATE TABLE public.winston_logs (
    "timestamp" timestamp with time zone,
    level character varying(255),
    message text,
    meta jsonb
);


ALTER TABLE public.winston_logs OWNER TO circleci;

--
-- Name: Agencies id; Type: DEFAULT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public."Agencies" ALTER COLUMN id SET DEFAULT nextval('public."Agencies_id_seq"'::regclass);


--
-- Name: Predictions id; Type: DEFAULT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public."Predictions" ALTER COLUMN id SET DEFAULT nextval('public."Predictions_id_seq"'::regclass);


--
-- Name: Surveys id; Type: DEFAULT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public."Surveys" ALTER COLUMN id SET DEFAULT nextval('public."Surveys_id_seq"'::regclass);


--
-- Name: Users id; Type: DEFAULT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public."Users" ALTER COLUMN id SET DEFAULT nextval('public."Users_id_seq"'::regclass);


--
-- Name: agency_alias id; Type: DEFAULT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.agency_alias ALTER COLUMN id SET DEFAULT nextval('public.agency_alias_id_seq'::regclass);


--
-- Name: attachment id; Type: DEFAULT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.attachment ALTER COLUMN id SET DEFAULT nextval('public.attachment_id_seq'::regclass);


--
-- Name: model id; Type: DEFAULT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.model ALTER COLUMN id SET DEFAULT nextval('public.model_id_seq'::regclass);


--
-- Name: notice id; Type: DEFAULT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.notice ALTER COLUMN id SET DEFAULT nextval('public.notice_id_seq'::regclass);


--
-- Name: notice_type id; Type: DEFAULT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.notice_type ALTER COLUMN id SET DEFAULT nextval('public.notice_type_id_seq'::regclass);


--
-- Name: solicitations id; Type: DEFAULT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.solicitations ALTER COLUMN id SET DEFAULT nextval('public.solicitations_id_seq'::regclass);


--
-- Name: survey_responses_archive id; Type: DEFAULT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.survey_responses_archive ALTER COLUMN id SET DEFAULT nextval('public.survey_responses_archive_id_seq'::regclass);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: agency_alias agency_alias_pk; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.agency_alias
    ADD CONSTRAINT agency_alias_pk PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: Agencies pk_Agencies; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public."Agencies"
    ADD CONSTRAINT "pk_Agencies" PRIMARY KEY (id);


--
-- Name: Surveys pk_Surveys; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public."Surveys"
    ADD CONSTRAINT "pk_Surveys" PRIMARY KEY (id);


--
-- Name: Users pk_Users; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "pk_Users" PRIMARY KEY (id);


--
-- Name: attachment pk_attachment; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.attachment
    ADD CONSTRAINT pk_attachment PRIMARY KEY (id);


--
-- Name: model pk_model; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT pk_model PRIMARY KEY (id);


--
-- Name: notice pk_notice; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.notice
    ADD CONSTRAINT pk_notice PRIMARY KEY (id);


--
-- Name: notice_type pk_notice_type; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.notice_type
    ADD CONSTRAINT pk_notice_type PRIMARY KEY (id);


--
-- Name: solicitations pk_solicitations; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.solicitations
    ADD CONSTRAINT pk_solicitations PRIMARY KEY (id);


--
-- Name: Predictions predictions_pk; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public."Predictions"
    ADD CONSTRAINT predictions_pk PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: solicitations solicitations_solNum_key; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.solicitations
    ADD CONSTRAINT "solicitations_solNum_key" UNIQUE ("solNum");


--
-- Name: survey_responses_archive survey_responses_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.survey_responses_archive
    ADD CONSTRAINT survey_responses_archive_pkey PRIMARY KEY (id);


--
-- Name: Predictions uniqueSolNum; Type: CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public."Predictions"
    ADD CONSTRAINT "uniqueSolNum" UNIQUE ("solNum");


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: circleci
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: ix_notice_solicitation_number; Type: INDEX; Schema: public; Owner: circleci
--

CREATE INDEX ix_notice_solicitation_number ON public.notice USING btree (solicitation_number);


--
-- Name: ix_notice_type_notice_type; Type: INDEX; Schema: public; Owner: circleci
--

CREATE INDEX ix_notice_type_notice_type ON public.notice_type USING btree (notice_type);


--
-- Name: ix_survey_responses_solNum; Type: INDEX; Schema: public; Owner: circleci
--

CREATE INDEX "ix_survey_responses_solNum" ON public.survey_responses USING btree ("solNum");


--
-- Name: attachment fk_attachment_notice_type_id_notice_type; Type: FK CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.attachment
    ADD CONSTRAINT fk_attachment_notice_type_id_notice_type FOREIGN KEY (notice_type_id) REFERENCES public.notice_type(id);


--
-- Name: attachment fk_attachment_solicitation_id_solicitations; Type: FK CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.attachment
    ADD CONSTRAINT fk_attachment_solicitation_id_solicitations FOREIGN KEY (solicitation_id) REFERENCES public.solicitations(id);


--
-- Name: notice fk_notice_notice_type_id_notice_type; Type: FK CONSTRAINT; Schema: public; Owner: circleci
--

ALTER TABLE ONLY public.notice
    ADD CONSTRAINT fk_notice_notice_type_id_notice_type FOREIGN KEY (notice_type_id) REFERENCES public.notice_type(id);


--
-- PostgreSQL database dump complete
--

