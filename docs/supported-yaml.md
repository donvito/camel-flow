# Supported YAML

The viewer reads **Camel 4 YAML DSL** files, including files written by Kaoto, without needing Camel on the classpath. Java DSL and XML DSL routes are not read.

## What is read

| YAML | Shown as |
|---|---|
| `- route:` (and the older bare `- from:`) | A route card |
| `- routeTemplate:` | A template card, which can also be reached as `kamelet:<id>` |
| `- templatedRoute:` | A route built from its template, with `{{parameters}}` filled in, so it links like a normal route |
| `- rest:` with `get` / `post` / `put` / `patch` / `delete` / `head` | An API node per operation, linked to the route in its `to:` |
| `rest: openApi:` | An API node for the contract |
| `kind: Integration` | Each item in `spec.flows` |
| `kind: Pipe` / `KameletBinding` | A route: `source` → `steps` → `sink` |
| `kind: Kamelet` | A template card for `spec.template` |
| `beans`, `routeConfiguration`, `errorHandler`, `restConfiguration`… | Recognised and skipped |

Every EIP in the official YAML DSL schema is understood, including nested `steps`, `choice` branches, `doTry` / `doCatch` / `doFinally`, `circuitBreaker` fallbacks, and newer EIPs such as `a2aSubTask`, `cache` and `pipeline`. Step `id`, `description`, `note` and `disabled` are shown. A step's `description` is used as its plain-language label.

### Endpoints

Endpoints are taken from `from`, `to`, `toD`, `wireTap`, `poll`, `enrich`, `pollEnrich`, `kamelet` and `recipientList`, in any of these forms:

```yaml
- to: kafka:orders                    # string
- to:
    uri: kafka:orders?brokers=b:9092  # uri with query
- to:
    uri: kafka                        # Kaoto style: the path as parameters
    parameters:
      topic: orders
```

All three read as `kafka:orders`.

## How connections are drawn

Two routes are connected when one **sends to** an endpoint the other **consumes from**:

| Line | Endpoints | Meaning |
|---|---|---|
| Solid, "calls" | `direct`, `direct-vm`, `kamelet` | Waits for the answer |
| Dashed, "hands off" | `seda`, `vm`, `disruptor` | Continues in the background |
| Animated, topic name | `kafka`, `jms` / `activemq` / `sjms` / `amqp` (treated as one broker), `rabbitmq`, `google-pubsub`, `aws2-sqs`, `nats`, MQTT, `pulsar`, Azure Service Bus / Event Hubs | Publishes an event |

When nothing in your files is on the other end, the endpoint becomes a **system node** instead, for example "Kafka · tickets.dlq". A `direct:` or `seda:` endpoint with no consuming route is flagged in red as a **missing route**.

**Triggers** don't become nodes. Instead they label the route card:
- timers and schedulers: "Every 5 minutes", "Daily at 08:00", "Weekdays at 09:30";
- `platform-http` and REST: "HTTP POST /orders".

**Dynamic destinations**, such as `toD` with `${…}`, `routingSlip`, `dynamicRouter`, or `recipientList` with an expression, are marked *dynamic* because they're only known at runtime. `${…}` inside a plain `to` (for example SQL `:#${header.id}`) is component syntax and is not treated as dynamic.

## System categories

Systems are coloured and grouped on route cards by category. Around 150 components have friendly names; anything else shows its scheme.

| Category | Examples |
|---|---|
| AI | `openai`, `langchain4j-*`, `spring-ai-*`, AWS Bedrock, Vertex AI, Azure OpenAI, watsonx, Hugging Face, Qdrant, Milvus, Pinecone, Weaviate, Chroma, PGVector, `mcp` |
| Database | `sql`, `jdbc`, `jpa`, `mongodb`, Cassandra, Redis, Elasticsearch / OpenSearch, DynamoDB, Cosmos DB, BigQuery, Snowflake, Debezium |
| Messaging | Kafka, JMS / ActiveMQ / AMQP, RabbitMQ, Pub/Sub, SQS / SNS, NATS, MQTT, Pulsar |
| API / HTTP | `http(s)`, `rest`, `rest-openapi`, GraphQL, SOAP (`cxf`), gRPC, WebSocket |
| Files & storage | `file`, FTP / SFTP, S3, Azure Blob / Data Lake, Google Cloud Storage, MinIO, SMB |
| Email | `mail` / `smtp` / `imap`, AWS SES, Exchange |
| Apps | Slack, Telegram, Salesforce, ServiceNow, Jira, GitHub, Twilio, Teams, Google Workspace, Stripe… |
| Cloud | Lambda, Step Functions, Azure / Google Functions, Kubernetes, Knative, Docker |
| Internal | `log`, `bean`, `mock`, templates, XSLT and other plumbing. These are hidden in the Executive view unless *Internal steps* is on. |

## Keeping up with new Camel versions

The EIP, language and top-level element lists come from Camel's schema `camelYamlDsl.json`. See [Development › Updating the Camel schema](development.md#updating-the-camel-schema).
