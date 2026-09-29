package io.camelviewer.graph;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Knowledge about Camel component schemes: a friendly name, a category for colors/icons,
 * whether the scheme links routes together, and whether it is an internal plumbing detail.
 */
public final class ComponentCatalog {

    public enum LinkKind { CALL, ASYNC, EVENT }

    public record Entry(
            String scheme,
            String name,
            String category,
            String linkFamily,
            LinkKind linkKind,
            boolean internal,
            boolean trigger) {}

    private static final Map<String, Entry> ENTRIES = new HashMap<>();

    private static void add(String category, String name, String... schemes) {
        for (String s : schemes) {
            ENTRIES.put(s, new Entry(s, name, category, null, null, false, false));
        }
    }

    private static void link(String family, LinkKind kind, String category, String name, String... schemes) {
        for (String s : schemes) {
            ENTRIES.put(s, new Entry(s, name, category, family, kind, false, false));
        }
    }

    private static void internal(String name, String... schemes) {
        for (String s : schemes) {
            ENTRIES.put(s, new Entry(s, name, "internal", null, null, true, false));
        }
    }

    private static void trigger(String category, String name, String... schemes) {
        for (String s : schemes) {
            ENTRIES.put(s, new Entry(s, name, category, null, null, false, true));
        }
    }

    static {
        // Route-to-route plumbing
        link("direct", LinkKind.CALL, "internal", "Direct call", "direct");
        link("direct-vm", LinkKind.CALL, "internal", "Direct call", "direct-vm");
        link("seda", LinkKind.ASYNC, "internal", "Async queue", "seda");
        link("vm", LinkKind.ASYNC, "internal", "Async queue", "vm");
        link("disruptor", LinkKind.ASYNC, "internal", "Async queue", "disruptor");
        link("disruptor-vm", LinkKind.ASYNC, "internal", "Async queue", "disruptor-vm");
        link("kamelet", LinkKind.CALL, "internal", "Kamelet", "kamelet");

        // Messaging (link routes when both ends are present, otherwise a system node)
        link("kafka", LinkKind.EVENT, "messaging", "Kafka", "kafka");
        link("jms", LinkKind.EVENT, "messaging", "JMS", "jms", "sjms", "sjms2");
        link("jms", LinkKind.EVENT, "messaging", "ActiveMQ", "activemq", "activemq6");
        link("jms", LinkKind.EVENT, "messaging", "AMQP", "amqp");
        link("rabbitmq", LinkKind.EVENT, "messaging", "RabbitMQ", "rabbitmq", "spring-rabbitmq");
        link("google-pubsub", LinkKind.EVENT, "messaging", "Google Pub/Sub", "google-pubsub");
        link("aws2-sqs", LinkKind.EVENT, "messaging", "AWS SQS", "aws2-sqs");
        link("nats", LinkKind.EVENT, "messaging", "NATS", "nats");
        link("mqtt", LinkKind.EVENT, "messaging", "MQTT", "paho", "paho-mqtt5");
        link("pulsar", LinkKind.EVENT, "messaging", "Pulsar", "pulsar");
        link("azure-servicebus", LinkKind.EVENT, "messaging", "Azure Service Bus", "azure-servicebus");
        link("azure-eventhubs", LinkKind.EVENT, "messaging", "Azure Event Hubs", "azure-eventhubs");
        add("messaging", "AWS SNS", "aws2-sns");
        add("messaging", "AWS EventBridge", "aws2-eventbridge");
        add("messaging", "AWS Kinesis", "aws2-kinesis", "aws2-kinesis-firehose");
        add("messaging", "IBM MQ", "ibmmq");
        add("messaging", "ZeroMQ", "zeromq");

        // AI
        add("ai", "OpenAI", "openai");
        add("ai", "LangChain4j Chat", "langchain4j-chat");
        add("ai", "LangChain4j Agent", "langchain4j-agent");
        add("ai", "LangChain4j Tools", "langchain4j-tools");
        add("ai", "LangChain4j Embeddings", "langchain4j-embeddings");
        add("ai", "LangChain4j Embedding Store", "langchain4j-embeddingstore");
        add("ai", "LangChain4j Tokenizer", "langchain4j-tokenizer");
        add("ai", "LangChain4j Web Search", "langchain4j-web-search");
        add("ai", "Spring AI Chat", "spring-ai-chat");
        add("ai", "Spring AI Embeddings", "spring-ai-embeddings");
        add("ai", "Spring AI Tools", "spring-ai-tools");
        add("ai", "Spring AI Vector Store", "spring-ai-vector-store");
        add("ai", "AWS Bedrock", "aws-bedrock", "aws-bedrock-agent", "aws-bedrock-agent-runtime");
        add("ai", "Google Vertex AI", "google-vertexai");
        add("ai", "Azure OpenAI", "azure-openai");
        add("ai", "IBM watsonx.ai", "ibm-watsonx-ai");
        add("ai", "Hugging Face", "huggingface");
        add("ai", "Deep Java Library", "djl");
        add("ai", "TorchServe", "torchserve");
        add("ai", "TensorFlow Serving", "tensorflow-serving");
        add("ai", "KServe", "kserve");
        add("ai", "Docling", "docling");
        add("ai", "Qdrant", "qdrant");
        add("ai", "Milvus", "milvus");
        add("ai", "Pinecone", "pinecone");
        add("ai", "Weaviate", "weaviate");
        add("ai", "Chroma", "chroma");
        add("ai", "Neo4j", "neo4j");
        add("ai", "PGVector", "pgvector");
        add("ai", "MCP", "mcp");
        add("ai", "Chat script", "chatscript");

        // Databases
        add("database", "SQL database", "sql", "sql-stored");
        add("database", "JDBC database", "jdbc", "spring-jdbc");
        add("database", "JPA", "jpa");
        add("database", "MongoDB", "mongodb", "mongodb-gridfs");
        add("database", "Cassandra", "cql");
        add("database", "Redis", "spring-redis");
        add("database", "Elasticsearch", "elasticsearch", "elasticsearch-rest-client");
        add("database", "OpenSearch", "opensearch");
        add("database", "Couchbase", "couchbase");
        add("database", "CouchDB", "couchdb");
        add("database", "DynamoDB", "aws2-ddb", "aws2-ddbstream");
        add("database", "Azure Cosmos DB", "azure-cosmosdb");
        add("database", "Google BigQuery", "google-bigquery", "google-bigquery-sql");
        add("database", "Google Firestore", "google-firestore");
        add("database", "InfluxDB", "influxdb", "influxdb2");
        add("database", "Infinispan", "infinispan");
        add("database", "Hazelcast", "hazelcast-map", "hazelcast-queue", "hazelcast-topic");
        add("database", "Caffeine cache", "caffeine-cache");
        add("database", "Snowflake", "snowflake");
        add("database", "ArangoDB", "arangodb");
        add("database", "Debezium CDC", "debezium-postgres", "debezium-mysql", "debezium-sqlserver",
                "debezium-oracle", "debezium-mongodb", "debezium-db2");

        // HTTP / APIs
        add("http", "HTTP API", "http", "https", "vertx-http", "netty-http", "ahc");
        add("http", "REST API", "rest", "rest-openapi");
        add("http", "GraphQL API", "graphql");
        add("http", "SOAP service", "cxf", "spring-ws");
        add("http", "gRPC service", "grpc");
        add("http", "WebSocket", "websocket", "vertx-websocket", "atmosphere-websocket");
        trigger("http", "HTTP endpoint", "platform-http", "jetty", "undertow", "servlet");

        // Files and object storage
        add("file", "File system", "file");
        add("file", "FTP", "ftp", "ftps");
        add("file", "SFTP", "sftp");
        add("file", "AWS S3", "aws2-s3");
        add("file", "Azure Blob Storage", "azure-storage-blob");
        add("file", "Azure Data Lake", "azure-storage-datalake");
        add("file", "Azure Files", "azure-files");
        add("file", "Google Cloud Storage", "google-storage");
        add("file", "MinIO", "minio");
        add("file", "SMB share", "smb");

        // Email & messaging apps
        add("email", "Email", "mail", "smtp", "smtps", "imap", "imaps", "pop3", "pop3s");
        add("email", "AWS SES", "aws2-ses");
        add("email", "Microsoft Exchange", "ews");

        // SaaS
        add("saas", "Slack", "slack");
        add("saas", "Telegram", "telegram");
        add("saas", "Salesforce", "salesforce");
        add("saas", "ServiceNow", "servicenow");
        add("saas", "Jira", "jira");
        add("saas", "GitHub", "github");
        add("saas", "Twilio", "twilio");
        add("saas", "WhatsApp", "whatsapp");
        add("saas", "Discord", "discord");
        add("saas", "Microsoft Teams", "teams");
        add("saas", "Google Sheets", "google-sheets", "google-sheets-stream");
        add("saas", "Google Drive", "google-drive");
        add("saas", "Google Mail", "google-mail", "google-mail-stream");
        add("saas", "Google Calendar", "google-calendar", "google-calendar-stream");
        add("saas", "SAP", "sap-netweaver");
        add("saas", "Box", "box");
        add("saas", "Dropbox", "dropbox");
        add("saas", "Stripe", "stripe");
        add("saas", "Twitter / X", "twitter-directmessage", "twitter-search", "twitter-timeline");

        // Cloud platform services
        add("cloud", "AWS Lambda", "aws2-lambda");
        add("cloud", "AWS Step Functions", "aws2-step-functions");
        add("cloud", "AWS CloudWatch", "aws2-cw");
        add("cloud", "Azure Functions", "azure-functions");
        add("cloud", "Google Functions", "google-functions");
        add("cloud", "Kubernetes", "kubernetes-pods", "kubernetes-deployments", "kubernetes-config-maps",
                "kubernetes-secrets", "kubernetes-services", "kubernetes-events", "kubernetes-job");
        add("cloud", "Knative", "knative");
        add("cloud", "Docker", "docker");

        // Schedulers (become trigger badges, not nodes)
        trigger("scheduler", "Timer", "timer");
        trigger("scheduler", "Scheduler", "scheduler");
        trigger("scheduler", "Cron", "cron");
        trigger("scheduler", "Quartz", "quartz");
        trigger("scheduler", "Spring event", "spring-event");

        // Plumbing that executives never need to see
        internal("Log", "log");
        internal("Bean", "bean");
        internal("Class", "class");
        internal("Mock", "mock");
        internal("Stub", "stub");
        internal("Dataset", "dataset", "dataset-test");
        internal("Language", "language");
        internal("Validator", "validator", "json-validator", "xml-validator");
        internal("Control bus", "controlbus");
        internal("Browse", "browse");
        internal("Ref", "ref");
        internal("XSLT", "xslt", "xslt-saxon");
        internal("Template", "velocity", "freemarker", "mustache", "jte", "string-template", "chunk");
        internal("Transform", "jolt", "jslt", "jsonata", "atlasmap", "dozer", "flatpack", "xj");
        internal("Exec", "exec");
        internal("Micrometer", "micrometer");
        internal("Metrics", "metrics");
    }

    /** Path parameters per scheme, in URI order (Camel's "syntax", e.g. {@code jms:destinationType:destinationName}). */
    private static final Map<String, List<String>> PATH_PARAMS = new HashMap<>();

    private static void path(List<String> params, String... schemes) {
        for (String s : schemes) PATH_PARAMS.put(s, params);
    }

    static {
        path(List.of("name"), "direct", "direct-vm", "seda", "vm", "disruptor", "disruptor-vm", "scheduler", "cron",
                "mock", "stub");
        path(List.of("templateId"), "kamelet");
        path(List.of("topic"), "kafka", "nats", "paho", "paho-mqtt5", "pulsar");
        path(List.of("destinationType", "destinationName"), "jms", "sjms", "sjms2", "activemq", "activemq6", "amqp");
        path(List.of("directoryName"), "file");
        path(List.of("host"), "ftp", "ftps", "sftp", "mail", "smtp", "smtps", "imap", "imaps", "pop3", "pop3s");
        path(List.of("timerName"), "timer");
        path(List.of("triggerName"), "quartz");
        path(List.of("query"), "sql");
        path(List.of("dataSourceName"), "jdbc", "spring-jdbc");
        path(List.of("httpUri"), "http", "https");
        path(List.of("path"), "platform-http");
        path(List.of("method", "path"), "rest");
        path(List.of("loggerName"), "log");
        path(List.of("beanName"), "bean");
        path(List.of("connectionBean"), "mongodb");
        path(List.of("operation"), "openai");
        path(List.of("chatId"), "langchain4j-chat", "spring-ai-chat");
        path(List.of("embeddingId"), "langchain4j-embeddings");
        path(List.of("toolId"), "langchain4j-tools");
        path(List.of("agentId"), "langchain4j-agent");
        path(List.of("channel"), "slack");
        path(List.of("bucketNameOrArn"), "aws2-s3");
        path(List.of("queueNameOrArn"), "aws2-sqs");
        path(List.of("topicNameOrArn"), "aws2-sns");
        path(List.of("projectId", "destinationName"), "google-pubsub");
        path(List.of("exchangeName"), "rabbitmq", "spring-rabbitmq");
        path(List.of("operationName"), "salesforce");
        path(List.of("type"), "telegram");
        path(List.of("collection"), "qdrant", "milvus", "pinecone", "weaviate", "chroma");
        path(List.of("resourceUri"), "xslt", "xslt-saxon", "velocity", "freemarker", "mustache", "jte", "jolt", "jslt");
    }

    public static List<String> pathParams(String scheme) {
        return PATH_PARAMS.getOrDefault(scheme, List.of());
    }

    private ComponentCatalog() {}

    /** Lookup a scheme, falling back to a generic entry that uses the scheme itself as its name. */
    public static Entry lookup(String scheme) {
        if (scheme == null || scheme.isBlank()) {
            return new Entry("", "Unknown", "other", null, null, false, false);
        }
        String s = scheme.toLowerCase(Locale.ROOT);
        Entry e = ENTRIES.get(s);
        if (e != null) {
            return e;
        }
        if (s.startsWith("langchain4j-") || s.startsWith("spring-ai-")) {
            return new Entry(s, humanizeScheme(s), "ai", null, null, false, false);
        }
        if (s.startsWith("aws2-") || s.startsWith("aws-")) {
            return new Entry(s, humanizeScheme(s), "cloud", null, null, false, false);
        }
        if (s.startsWith("azure-") || s.startsWith("google-")) {
            return new Entry(s, humanizeScheme(s), "cloud", null, null, false, false);
        }
        if (s.startsWith("debezium-")) {
            return new Entry(s, "Debezium CDC", "database", null, null, false, false);
        }
        return new Entry(s, humanizeScheme(s), "other", null, null, false, false);
    }

    static String humanizeScheme(String scheme) {
        StringBuilder sb = new StringBuilder();
        for (String part : scheme.split("[-_]")) {
            if (part.isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            if (part.length() <= 3 && !part.equals("sql")) {
                sb.append(part.toUpperCase(Locale.ROOT));
            } else {
                sb.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
            }
        }
        return sb.toString();
    }
}
