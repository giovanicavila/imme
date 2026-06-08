# RAG Project — Complete Documentation

> **A comprehensive deep-dive into the architecture, design patterns, implementation details, and extension points of this Retrieval-Augmented Generation system.**

---

## Table of Contents

1. [Overview & Philosophy](#1-overview--philosophy)
2. [Technology Stack](#2-technology-stack)
3. [Directory Structure](#3-directory-structure)
4. [Core Architectural Patterns](#4-core-architectural-patterns)
5. [Layer-by-Layer Breakdown](#5-layer-by-layer-breakdown)
6. [Data Flow](#6-data-flow)
7. [The Provider Pattern](#7-the-provider-pattern)
8. [Hybrid Search & RRF](#8-hybrid-search--rrf)
9. [Retrieval Observability](#9-retrieval-observability)
10. [Agentic RAG Pipeline](#10-agentic-rag-pipeline)
11. [Evaluation with RAGAS](#11-evaluation-with-ragas)
12. [Configuration System](#12-configuration-system)
13. [Key Design Decisions](#13-key-design-decisions)
14. [Extension Guide](#14-extension-guide)

---

## 1. Overview & Philosophy

This is a **Retrieval-Augmented Generation (RAG) API** built with FastAPI. It answers user questions by retrieving relevant document chunks using **hybrid search** (BM25 + vector similarity fused via Reciprocal Rank Fusion) and generating grounded responses via an LLM. The system includes an **agentic self-correction loop** that plans, retrieves, grades, and rewrites queries until relevant context is found.

### Core Philosophy

- **Model-agnostic:** Never tie the codebase to a single LLM or embedding provider. All external model calls go through abstract interfaces.
- **Provider Pattern:** Swapping from OpenRouter to Ollama or from local embeddings to OpenAI requires zero code changes — only environment variable updates.
- **Zero business logic in HTTP layer:** `routes.py` only validates and delegates. All intelligence lives in `core/`.
- **Agentic self-correction:** The system doesn't just retrieve once. It plans, retrieves, grades, and rewrites until it finds relevant context.
- **Hybrid search first:** Combining lexical (BM25) and semantic (vector) search through RRF produces more robust retrieval than either method alone.
- **Observability built-in:** A dedicated explain endpoint lets developers inspect every stage of the retrieval pipeline without invoking the LLM.
- **Configuration via environment:** No hardcoded API keys, model names, or URLs anywhere.

---

## 2. Technology Stack

| Component | Technology |
|-----------|------------|
| Web Framework | FastAPI + Pydantic v2 |
| Vector Store | ChromaDB (local, persistent, on-disk) |
| Lexical Search | BM25Okapi via `rank-bm25` (pure Python) |
| Hybrid Fusion | Reciprocal Rank Fusion (RRF, custom implementation) |
| Embeddings | sentence-transformers (default, local) or OpenAI-compatible APIs |
| LLM Generation | OpenAI-compatible APIs (OpenRouter, Ollama, OpenAI) |
| Semantic Chunking | Chonkie (SemanticChunker) |
| Evaluation | RAGAS |
| Orchestration | Custom agent loop (not LangChain) |

---

## 3. Directory Structure

```
RAG_PROJECT/
├── app/
│   ├── api/
│   │   └── routes.py              ← HTTP endpoints: /query, /ingest, /retrieval/explain, /health
│   ├── core/
│   │   ├── agent/
│   │   │   ├── state.py           ← AgentState dataclass (tracks question, context, attempts)
│   │   │   ├── planner.py         ← Decides: retrieve from DB or answer directly
│   │   │   ├── grader.py          ← Binary judge: is the retrieved context relevant?
│   │   │   ├── rewriter.py        ← Reformulates queries to improve retrieval quality
│   │   │   └── tools.py           ← RetrievalTool wrapper around retriever.search()
│   │   ├── chunker/
│   │   │   └── chunker.py         ← SemanticChunker (Chonkie) for intelligent splitting
│   │   ├── embeddings/
│   │   │   ├── base.py            ← BaseEmbedder (abstract base class)
│   │   │   ├── sentence_transformers_embedder.py  ← Local embedding (no API key)
│   │   │   ├── openai_embedder.py  ← OpenAI-compatible embedding API
│   │   │   └── factory.py         ← get_embedder() → singleton based on config
│   │   ├── generation/
│   │   │   ├── base.py            ← BaseLLM (abstract base class)
│   │   │   ├── openai_compatible_llm.py  ← Single class for all OAI-compatible providers
│   │   │   └── factory.py         ← get_llm() / get_agent_llm() → singletons
│   │   ├── prompts/
│   │   │   └── templates.py       ← RAG_SYSTEM_PROMPT + build_context() formatter
│   │   ├── retrieval/
│   │   │   └── retriever.py       ← VectorRetriever + BM25Retriever + HybridRetriever (RRF)
│   │   └── pipeline.py            ← Orchestrates the full RAG + agentic loop
│   └── models/
│       └── schemas.py             ← All Pydantic request/response models
├── evaluation/                     ← RAG quality metrics (RAGAS)
│   ├── cli.py
│   ├── runner.py
│   ├── config.py
│   ├── serializers.py
│   ├── datasets/
│   │   ├── loader.py
│   │   └── builder.py
│   ├── metrics/
│   │   ├── groups.py
│   │   ├── llm.py
│   │   └── registry.py
│   └── data/
│       └── questions.json
├── scripts/
│   ├── ingestion/
│   │   └── ingest.py              ← Indexes documents into ChromaDB + BM25 corpus
│   └── chromadb/
│       ├── test_chromadb.py       ← Smoke test for ChromaDB connectivity
│       └── view_chunks.py         ← Utility to inspect stored chunks
├── config.py                      ← Pydantic Settings (reads from .env)
├── main.py                        ← FastAPI app entrypoint
├── requirements.txt
├── README.md                      ← Quickstart & architecture overview
├── DOCUMENTATION.md               ← This file — comprehensive reference
└── chrome.md                      ← ChromaDB tutorial (Portuguese)
```

---

## 4. Core Architectural Patterns

### 4.1 Abstract Base Class (ABC) + Factory

Both LLM and Embedding providers implement a base interface. The factory reads config and returns the correct instance. The rest of the app interacts only with the base class.

```
BaseLLM.generate(prompt) ──► OpenAICompatibleLLM
                     ──► (future: AnthropicLLM, LocalTransformersLLM)

BaseEmbedder.embed_text(text) ──► SentenceTransformersEmbedder
                          ──► OpenAIEmbedder
```

### 4.2 Singleton for Heavy Clients

Expensive objects (embedding model, LLM client, ChromaDB collection, BM25 index) are instantiated **once** at import time and reused everywhere via module-level variables:

```python
from app.core.embeddings.factory import embedder
from app.core.generation.factory import llm, agent_llm
from app.core.retrieval.retriever import retriever  # HybridRetriever (vector + BM25 + RRF)
```

Benefits:
- Avoids cold-start latency on every request
- Prevents connection pool exhaustion
- HuggingFace models are cached in `~/.cache/` after first download

### 4.3 Dependency Direction

```
main.py
  │  imports → routes.py
  │            │ calls → pipeline.py
  │            │       │ uses → planner / grader / rewriter / retrieval_tool
  │            │       │   │     └── agent_llm (from factory)
  │            │       │   │
  │            │       │   └── retriever (HybridRetriever — vector + BM25 + RRF)
  │            │       │       └── embedder (from factory)
  │            │       │
  │            │       └── llm (from factory)
  │            │           └── generates final answer
  │            │
  │            ├── /retrieval/explain
  │            │   └── retriever.explain()
  │            │
  │            └── schemas.py (shared Pydantic models)
```

**Rule:** Lower layers never import upper layers. `pipeline.py` never imports `routes.py`.

---

## 5. Layer-by-Layer Breakdown

### 5.1 API Layer — `app/api/routes.py`

**Responsibility:** Accept HTTP requests, validate bodies, delegate to core, return typed responses.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/query` | POST | Ask a question, get a RAG answer |
| `/api/v1/ingest` | POST | Index a document into the search corpus |
| `/api/v1/retrieval/explain` | POST | Debug retrieval without invoking LLM |
| `/api/v1/health` | GET | Health check |

The endpoint logic is consciously thin — it validates input, calls a core function, and returns a typed response.

```python
@router.post("/retrieval/explain", response_model=RetrievalExplainResponse)
async def retrieval_explain(request: RetrievalExplainRequest):
    return retriever.explain(request.query, request.top_k)
```

### 5.2 Core Layer — `app/core/`

This is where all business logic lives.

#### 5.2.1 Pipeline (`pipeline.py`)

The main entry point. Implements an **agentic loop** with up to 3 retrieval attempts:

```
1. Planner decides: "retrieve" or "direct answer"
2. If "direct" → ask LLM, done
3. For up to 3 attempts:
   a. Retrieve chunks via HybridRetriever (BM25 + Vector + RRF)
   b. Grade if context is relevant to question
   c. If relevant → build prompt, generate answer, done
   d. If not → rewriter rewrites the query, retry
4. Fallback: if nothing found after 3 attempts → direct answer
```

#### 5.2.2 Agents (`agent/`)

| Agent | Model | Purpose | Output |
|-------|-------|---------|--------|
| **Planner** | `agent_llm` | Routes questions — "direct" for known facts, "retrieve" for domain knowledge | `{"action": "retrieve" \| "direct"}` |
| **Grader** | `agent_llm` | Binary judge — is the retrieved context sufficient to answer? | `{"relevant": true \| false}` |
| **Rewriter** | `agent_llm` | Transforms vague queries into retrieval-friendly forms | Rewritten query string |
| **Tools** | — | Thin wrapper around `retriever.search()` decoupling agents from storage | `list[SourceDocument]` |

Each agent uses `agent_llm` — typically a cheaper/faster model than the main generation LLM.

#### 5.2.3 Generation (`generation/`)

- **`base.py`** — `BaseLLM` abstract class with `generate(prompt) -> str`
- **`openai_compatible_llm.py`** — Single class covering all OpenAI-Chat-Completions-compatible APIs (OpenRouter, Ollama, OpenAI, vLLM, Groq, LM Studio)
- **`factory.py`** — Returns `llm` (main generator) and `agent_llm` (planner/grader/rewriter) as singletons

#### 5.2.4 Embeddings (`embeddings/`)

- **`base.py`** — `BaseEmbedder` with `embed_text()` and `embed_batch()`
- **`sentence_transformers_embedder.py`** — Runs locally, downloads on first use, normalizes vectors for cosine similarity
- **`openai_embedder.py`** — Calls OpenAI-compatible `/embeddings` endpoint
- **`factory.py`** — Returns the configured singleton

#### 5.2.5 Retrieval (`retrieval/retriever.py`)

The retrieval layer contains three classes forming a **chain of responsibility**:

| Class | Role |
|-------|------|
| `VectorRetriever` | Semantic search via ChromaDB (embedding similarity) |
| `BM25Retriever` | Lexical search via BM25Okapi (keyword matching) |
| `HybridRetriever` | Orchestrates both + applies RRF; also exposes `explain()` |

**VectorRetriever:**
1. Embeds the query via `embedder.embed_text(query)`
2. Queries ChromaDB with cosine distance
3. Converts distance to similarity: `score = 1 - distance`
4. Returns `list[SourceDocument]`

**BM25Retriever:**
1. Stores document corpus in memory
2. Builds a `BM25Okapi` index from tokenized documents
3. Tokenizes query by lowercasing + splitting
4. Returns raw BM25 scores (unnormalized), skipping zero-score documents
5. Index is rebuilt lazily when new documents are added (`_dirty` flag)
6. On startup, syncs all documents from ChromaDB to maintain persistence

**HybridRetriever:**
- Orchestrates both retrievers based on `search_mode`:
  - `"vector"` — vector search only
  - `"lexical"` — BM25 only
  - `"hybrid"` (default) — both + RRF fusion
- Queries each retriever at `2x top_k`, then fuses via RRF

#### 5.2.6 Chunking (`chunker/chunker.py`)

Uses `Chonkie.SemanticChunker` which splits text by semantic meaning using the embedding model itself. This is superior to fixed-token chunking for question-answering because boundaries respect sentence/paragraph coherence.

Parameters:
- `threshold=0.75` — semantic shift threshold for split detection
- `chunk_size=512` — maximum tokens per chunk
- `similarity_window=3` — window size for similarity comparison

#### 5.2.7 Prompts (`prompts/templates.py`)

Contains the RAG system prompt with instructions on when to use retrieved context versus parametric knowledge. `build_context()` formats chunks into a numbered block:

```
[1] Source: document.txt
chunk content here

---

[2] Source: another.txt
second chunk here
```

### 5.3 Models — `app/models/schemas.py`

Pure Pydantic models shared across the app.

| Class | Role |
|-------|------|
| `QueryRequest` | Validates `question` (3–1000 chars) + optional `top_k` (1–20) |
| `QueryResponse` | Returns `answer`, `sources[]`, and `question` |
| `SourceDocument` | One retrieved chunk with `id`, `content`, `source`, `score` |
| `IngestRequest` | Validates `text` (≥10 chars) + `source_name` |
| `IngestResponse` | Returns `message`, `chunks_created`, `source` |
| `RetrievalExplainRequest` | Validates `query` + optional `top_k` (1–50) |
| `RetrievalExplainResponse` | Returns all retrieval stages |

### 5.4 Ingestion — `scripts/ingestion/ingest.py`

A standalone script to index documents. Can be triggered via the `/ingest` API endpoint or used programmatically.

Flow:
1. Receives texts, metadatas, and IDs
2. Embeds texts via `embedder.embed_batch()`
3. Upserts into ChromaDB
4. Updates the BM25 corpus via `retriever.add_documents()`

### 5.5 Scripts — `scripts/chromadb/`

| Script | Purpose |
|--------|---------|
| `test_chromadb.py` | Smoke test for ChromaDB connectivity and basic operations |
| `view_chunks.py` | Utility to inspect stored chunks, their metadata, and counts |

---

## 6. Data Flow

### 6.1 Query Flow (Runtime)

```
Client Request
      │
      ▼
┌──────────────┐
│ /query       │
│ FastAPI      │
│ + Pydantic   │      QueryRequest
└──────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────┐
│ run_rag_pipeline(question, top_k)                   │
│                                                     │
│  ┌──────────┐                                       │
│  │ Planner  │  → "retrieve" or "direct"              │
│  │ (agent)  │                                       │
│  └──────────┘                                       │
│         │                                           │
│         ▼ direct?                                   │
│      ┌──────────────┐                               │
│      │  LLM.generate│ → parametric answer, DONE    │
│      └──────────────┘                               │
│         │                                           │
│         ▼ retrieve?                                  │
│  ┌─────────────────────────────────────────────┐   │
│  │ Loop: up to 3 attempts                      │   │
│  │                                             │   │
│  │  ┌──────────────────┐  ┌─────────┐  ┌─────┐ │   │
│  │  │ HybridRetriever  │─▶│ grade   │ │rewrite│ │   │
│  │  │ BM25 + Vector    │  │ relevant?│ │ query │ │   │
│  │  │      + RRF       │  └────┬────┘  └──┬───┘ │   │
│  │  └──────────────────┘       │ yes      │ no  │   │
│  │                             ▼          └─────▶│   │
│  │                      break loop               │   │
│  └─────────────────────────────────────────────┘   │
│                         │                           │
│                         ▼ no sources after 3 tries   │
│                  ┌──────────────┐                   │
│                  │ fallback to  │                   │
│                  │ parametric   │                   │
│                  │ answer       │                   │
│                  └──────────────┘                   │
│                         ▼                           │
│                  ┌──────────────┐                   │
│                  │ LLM.generate │ ← with context   │
│                  │ (RAG prompt) │                   │
│                  └──────────────┘                   │
└─────────────────────────────────────────────────────┘
      │
      ▼
QueryResponse(answer, sources[], question)
```

### 6.2 Ingestion Flow

```
Client Request
      │
      ▼
IngestRequest(text, source_name)
      │
      ▼
SemanticChunker.split(text)  →  list of Chunk objects (text, token_count)
      │
      ▼
Assign metadata: {source, chunk_index, token_count}
      │
      ▼
embedder.embed_batch(chunks)
      │
      ▼
ChromaDB.collection.upsert(ids, embeddings, documents, metadatas)
      │
      ▼
retriever.add_documents(texts, metadatas, ids)
  → updates BM25 corpus, marks index as dirty
      │
      ▼
IngestResponse(message, chunks_created, source)
```

### 6.3 Hybrid Search Flow

```
Query: "How to reset my password?"
      │
      ├──────────────────────────────────────┐
      ▼                                      ▼
┌──────────────┐                    ┌──────────────┐
│ VectorRetriever                   │ BM25Retriever │
│ 1. embed query                    │ 1. tokenize   │
│ 2. ChromaDB query                 │ 2. BM25 scores│
│ 3. similarity = 1 - distance      │ 3. raw scores │
│ 4. list[SourceDocument]           │ 4. list[dict] │
└──────┬───────┘                    └──────┬───────┘
       │                                    │
       └──────────┬─────────────────────────┘
                  ▼
        ┌──────────────────┐
        │  RRF Fusion       │
        │  k = 60           │
        │                   │
        │  For each doc:    │
        │  score = 1/(60 + rank_vec)     │
        │        + 1/(60 + rank_bm25)    │
        │                   │
        │  Sort by score    │
        └──────────────────┘
                  │
                  ▼
        Final ranked results (top_k)
```

---

## 7. The Provider Pattern

This is the **most important pattern** in the project. It makes the system immune to provider churn.

### 7.1 How It Works

```
App Code ──► BaseLLM.generate()
                │
                └──► Factory decides at startup:
                       if provider == "ollama":     → OpenAICompatibleLLM(base_url=localhost:11434)
                       if provider == "openrouter": → OpenAICompatibleLLM(base_url=openrouter.ai)
                       if provider == "openai":     → OpenAICompatibleLLM(base_url=api.openai.com)
```

### 7.2 Benefits

- **Zero code changes** to swap providers — only `.env` updates
- **Testability** — mock `BaseLLM` or `BaseEmbedder` in unit tests
- **Future-proofing** — Anthropic, Gemini, or local GGUF models can be added by writing one new class
- **Single source of truth** — provider URLs and fallback logic live in one place (`factory.py`)
- **Dual LLM support** — a cheap `agent_llm` for planning/grading/rewriting and a powerful `llm` for final answers

### 7.3 The Two LLM Pattern

```
┌─────────────────────┐     ┌──────────────────────┐
│   agent_llm         │     │   llm                │
│   (cheap/fast)      │     │   (powerful)         │
│                     │     │                      │
│  - planner.decide() │     │  - final RAG answer  │
│  - grader.grade()   │     │  - direct answer     │
│  - rewriter.rewrite()│    │                      │
└─────────────────────┘     └──────────────────────┘
```

### 7.4 Adding a New Provider

1. **LLM**: Implement `BaseLLM` in a new file at `app/core/generation/`
2. **Embeddings**: Implement `BaseEmbedder` in a new file at `app/core/embeddings/`
3. Add the provider literal to `config.py` (LLM or embedding)
4. Add the branch in the corresponding `factory.py`
5. Set the new provider name in `.env`

---

## 8. Hybrid Search & RRF

### 8.1 Motivation

Vector search excels at semantic similarity but fails on exact keyword matches. BM25 excels at keyword matching but ignores meaning. Hybrid search combines both strengths via **Reciprocal Rank Fusion (RRF)**.

### 8.2 BM25 (Lexical Search)

**Algorithm:** BM25Okapi is a bag-of-words ranking function that scores documents based on query term frequency, inverse document frequency, and document length normalization.

```
score(D, Q) = Σ (IDF(q) · TF(q, D) · (k₁ + 1) / (TF(q, D) + k₁ · (1 - b + b · |D| / avgdl)))
```

**Implementation (`BM25Retriever`):**

```python
class BM25Retriever:
    def __init__(self):
        self._documents: list[dict] = []
        self._bm25: BM25Okapi | None = None
        self._dirty = False  # rebuild needed?
```

Key behaviors:
- **Lazy indexing**: BM25 index is built on first search and rebuilt when new documents are added
- **Zero-score filtering**: Documents with BM25 score ≤ 0 are excluded from results
- **Persistence**: On startup, all documents from ChromaDB are loaded into the corpus
- **Raw scores exposed**: The `search_raw()` method returns unnormalized BM25 scores for observability

### 8.3 Vector Search (Semantic)

Uses ChromaDB with cosine similarity. Documents and queries are embedded into a 384-dimensional vector space (using `all-MiniLM-L6-v2` by default). ChromaDB returns cosine distance (0 = identical, 2 = opposite), which is converted to similarity:

```python
score = round(1 - distance, 4)  # 1.0 = identical, ~0.0 = irrelevant
```

### 8.4 Reciprocal Rank Fusion (RRF)

RRF is a simple yet effective method for combining multiple ranking lists:

```
RRF_score(d) = Σ 1 / (k + rank_i(d))

where:
- k = constant (default: 60, configurable via RRF_K)
- rank_i(d) = rank of document d in system i's result list
```

**Why RRF over score averaging?**
- Rankings are more comparable across heterogeneous systems than raw scores
- BM25 scores and cosine similarity operate on completely different scales
- RRF is robust to missing documents in one system
- No parameter tuning required (k=60 works well empirically)

**Implementation (`HybridRetriever._rrf_fuse`):**

```python
def _rrf_fuse(self, vector_results, bm25_results, top_k):
    # Track per-document RRF scores
    rrf_scores = {}
    for rank, doc in enumerate(vector_results):
        rrf_scores[doc.id] = 1.0 / (RRF_K + rank + 1)
    for rank, doc in enumerate(bm25_results):
        rrf_scores[doc.id] = rrf_scores.get(doc.id, 0.0) + 1.0 / (RRF_K + rank + 1)
    # Sort by RRF score descending
    reranked = sorted(all_ids, key=lambda id: rrf_scores[id], reverse=True)
    return reranked[:top_k]
```

### 8.5 Configuration

```python
# config.py
search_mode: Literal["hybrid", "vector", "lexical"] = "hybrid"
rrf_k: int = 60
```

Set `SEARCH_MODE=vector` in `.env` to disable BM25 and use vector search only (useful for comparison/testing).

---

## 9. Retrieval Observability

### 9.1 Purpose

The `/retrieval/explain` endpoint lets developers inspect and debug the retrieval pipeline **without invoking the LLM**. This is essential for:

- Understanding why a particular document was retrieved
- Comparing BM25 vs vector search performance on a query
- Debugging RRF fusion behavior
- Tuning `top_k` and `rrf_k` parameters
- Identifying gaps in the document corpus

### 9.2 Endpoint

```
POST /api/v1/retrieval/explain
{
  "query": "How can I enable 2FA?",
  "top_k": 5
}
```

### 9.3 Response Structure

The response contains four stages, each showing exactly what the production pipeline produces:

```json
{
  "query": "How can I enable 2FA?",
  "bm25_results": [
    {
      "rank": 1,
      "score": 12.45,
      "document_id": "doc_001",
      "source_name": "security-guide",
      "text_preview": "Multi-factor authentication can be enabled..."
    }
  ],
  "vector_results": [
    {
      "rank": 1,
      "score": 0.932,
      "document_id": "doc_001",
      "source_name": "security-guide",
      "text_preview": "Multi-factor authentication can be enabled..."
    }
  ],
  "hybrid_results": [
    {
      "rank": 1,
      "rrf_score": 0.03252,
      "document_id": "doc_001",
      "source_name": "security-guide",
      "bm25_rank": 3,
      "bm25_score": 8.41,
      "vector_rank": 1,
      "vector_score": 0.932
    }
  ],
  "reranked_results": []
}
```

| Field | Description |
|-------|-------------|
| `bm25_results` | Raw BM25 scores (unnormalized), only documents with score > 0 |
| `vector_results` | Cosine similarity scores (0 to 1), from ChromaDB |
| `hybrid_results` | RRF-fused ranking with per-document contributions from each system |
| `reranked_results` | Placeholder for future cross-encoder reranker |

If a document is only found by one method, the other method's fields are `null`:

```json
{
  "rank": 2,
  "rrf_score": 0.01639,
  "document_id": "doc_002",
  "source_name": "user-guide",
  "bm25_rank": null,
  "bm25_score": null,
  "vector_rank": 2,
  "vector_score": 0.887
}
```

### 9.4 Implementation

The `HybridRetriever.explain()` method runs all retrieval stages independently and returns a dict matching the response schema:

```python
def explain(self, query: str, top_k: int | None = None) -> dict:
    bm25_raw = self.bm25.search_raw(query, top_k=k)    # raw BM25 scores
    vector_raw = self.vector.search(query, top_k=k)      # similarity scores
    
    # Build per-stage results with text_preview (200 chars)
    # Build id→rank and id→score maps for both systems
    # Compute RRF scores for all unique document IDs
    # Return full explain dict
```

### 9.5 Deterministic Debugging

- **No LLM calls** — avoids nondeterminism from generation
- **Raw scores preserved** — BM25 scores are exact, not normalized
- **200-char preview** — enough to identify documents without verbosity
- **Per-stage isolation** — see exactly how each rank changes through the pipeline

---

## 10. Agentic RAG Pipeline

### 10.1 Why Agentic?

Single-shot RAG fails when:
- Retrieved chunks are irrelevant
- The question is vague or ambiguous
- The corpus doesn't contain the answer

The agent loop handles all these cases through self-correction.

### 10.2 Loop Detail

The pipeline (`pipeline.py`) runs an adaptive agent loop with up to 3 retrieval attempts:

```
1. Planner decides: "retrieve" or "direct answer"
2. If "direct" → LLM generates from parametric memory, done
3. For attempt in 1..3:
   a. Retrieve top_k chunks via HybridRetriever (BM25 + Vector + RRF)
   b. If no chunks found → rewrite query, retry
   c. Grader evaluates context relevance
   d. If relevant → break loop
   e. If not → rewriter reformulates query → retry
4. If no sources after all attempts → fallback to parametric answer
5. Build RAG prompt with context → LLM generates grounded answer
```

### 10.3 Agent State

The `AgentState` dataclass tracks state across turns:

```python
@dataclass
class AgentState:
    original_question: str      # Unchanged user input
    current_question: str       # May be rewritten by rewriter
    context: list[SourceDocument]  # Retrieved chunks
    attempts: int               # Retry counter
    action: str                 # "retrieve" or "direct"
```

### 10.4 Agent Details

#### Planner

Routes questions based on whether the LLM can answer from parametric memory or needs document retrieval.

```
Prompt: "What is 2 + 2?"                  → {"action": "direct"}
Prompt: "What does the warranty cover?"    → {"action": "retrieve"}
```

Defaults to "retrieve" on any parsing failure (fail-safe behavior).

#### Grader

Binary relevance judge. Evaluates whether the concatenated context contains sufficient information to answer the original question.

- Returns `{"relevant": true}` or `{"relevant": false}`
- Strips markdown fences from LLM response before parsing
- Defaults to `false` on parse failure

#### Rewriter

Transforms vague or poorly-phrased questions into more specific, retrieval-friendly queries.

```
Input:  "how fast?"
Output: "what is the top speed of the X-200 engine?"
```

---

## 11. Evaluation with RAGAS

### 11.1 Architecture

The evaluation module lives in `evaluation/` and is fully independent of the main app. It runs the live RAG pipeline against a set of test questions and computes quality metrics using **RAGAS**.

```
evaluation/
├── cli.py           ← CLI entry point
├── runner.py        ← Orchestrates evaluation
├── config.py        ← Paths config
├── serializers.py   ← Saves results as JSON
├── datasets/
│   ├── loader.py    ← Loads questions from JSON/CSV
│   └── builder.py   ← Runs RAG pipeline for each question → builds EvaluationDataset
├── metrics/
│   ├── registry.py  ← Binds RAGAS metrics to evaluation judge
│   ├── groups.py    ← Defines evaluation modes
│   └── llm.py       ← Configures the judge LLM + embeddings
├── data/
│   └── questions.json  ← Test questions with ground truth
└── results/         ← Output directory (timestamped JSON)
```

### 11.2 Running an Evaluation

```bash
# Quick mode (context_precision + relevancy)
python -m evaluation.cli --mode quick

# Full evaluation (all metrics)
python -m evaluation.cli --mode full

# Custom data
python -m evaluation.cli --questions my_data.json --mode full --output ./my_results
```

### 11.3 Evaluation Modes

| Mode | Metrics |
|------|---------|
| `quick` | `context_precision`, `answer_relevancy` |
| `retrieval` | `context_precision`, `context_recall` |
| `generation` | `answer_relevancy`, `faithfulness` |
| `full` | All above metrics |

### 11.4 Data Format

```json
[
  {
    "question": "Who created LimeDB?",
    "ground_truth": "The creators are ..."
  },
  {
    "question": "What is LimeDB?",
    "ground_truth": "LimeDB is a vector database for RAG ..."
  }
]
```

### 11.5 Runner Flow

```
1. Load questions from JSON
2. For each question:
   a. Build dataset by running the RAG pipeline
   b. Collect: question, answer, retrieved contexts, ground truth
3. Compute RAGAS metrics using judge LLM
4. Save timestamped JSON results to evaluation/results/
```

---

## 12. Configuration System

### 12.1 `config.py`

Uses **Pydantic Settings v2** for type-safe, validated configuration loaded from `.env`.

| Group | Settings |
|-------|----------|
| LLM (generation) | `llm_provider`, `llm_model`, `llm_api_key`, `llm_base_url` |
| LLM (agent) | `agent_llm_provider`, `agent_llm_model`, `agent_llm_api_key`, `agent_llm_base_url` |
| Embedding | `embedding_provider`, `embedding_model`, `embedding_dimension`, `embedding_api_key` |
| Vector Store | `vector_store_provider`, `vector_store_persist_directory`, `vector_store_collection_name`, `vector_store_similarity_metric` |
| Search / RRF | `search_mode` (hybrid/vector/lexical), `rrf_k` (default 60) |
| RAG | `top_k`, `max_tokens`, `temperature` |

### 12.2 Auto-fallback Logic

- If `agent_llm_api_key` is empty → falls back to `llm_api_key`
- If `agent_llm_base_url` is empty → falls back to `llm_base_url`
- Ensures agent LLM can share credentials without redundant config

### 12.3 Validation

Raises `ValueError` at startup for:
- Missing API key when provider requires one
- Unsupported provider strings

### 12.4 `.env` File

```bash
LLM_PROVIDER=openrouter
LLM_MODEL=moonshotai/kimi-k2
LLM_API_KEY=sk-or-v1-...

AGENT_LLM_PROVIDER=openrouter
AGENT_LLM_MODEL=nousresearch/hermes-3-llama-3.1-405b:free

EMBEDDING_PROVIDER=sentence_transformers
EMBEDDING_MODEL=all-MiniLM-L6-v2

SEARCH_MODE=hybrid
RRF_K=60

TOP_K=4
```

---

## 13. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **No LangChain** | LangChain adds abstraction overhead and debugging complexity. Custom agent loop is ~300 lines vs 1000+ with LCEL. |
| **Hybrid search (BM25 + Vector + RRF)** | Vector search misses exact keyword matches; BM25 misses semantics. RRF combines both without score normalization. |
| **BM25 index synced from ChromaDB** | Avoids a separate persistence mechanism — ChromaDB is the single source of truth. BM25 index is rebuilt on startup. |
| **RRF over weighted sum** | Rankings are more comparable than scores across heterogeneous systems. No parameter tuning beyond k. |
| **Separate agent LLM** | Planner/grader/rewriter calls are frequent but simple. A cheaper model reduces cost without sacrificing quality. |
| **Semantic chunking** | Fixed-token chunking splits sentences mid-thought. Semantic chunking (Chonkie) respects sentence/paragraph boundaries using embedding similarity shifts. |
| **Cosine similarity** | ChromaDB default. Embeddings are L2-normalized, converting cosine distance (0..2) to similarity score (`1 - distance`). |
| **Singleton factories** | Embedding models are ~100MB+ to load; ChromaDB clients hold connection pools. Per-request instantiation would be wasteful. |
| **Pydantic v2** | Input validation, serialization, and OpenAPI docs from a single schema definition. |
| **Synchronous core** | ChromaDB and sentence-transformers are synchronous. Wrapping in async adds complexity without benefit for a local-first API. |
| **Fallback on failure** | If retrieval yields nothing after 3 attempts, the system falls back to parametric knowledge rather than returning empty-handed. |
| **Explain endpoint** | Makes retrieval debugging possible without LLM calls. Observability is a first-class feature, not an afterthought. |
| **Raw BM25 scores in explain** | Normalized scores lose information. The explain endpoint returns raw BM25 scores for accurate debugging. |

---

## 14. Extension Guide

### 14.1 Adding a New LLM Provider

1. Create `app/core/generation/anthropic_llm.py` implementing `BaseLLM`
2. Add provider to `llm_provider` / `agent_llm_provider` Literal in `config.py`
3. Add default `base_url` in `generation/factory.py._BASE_URLS`
4. Add API key validation in `config.py`'s `@model_validator`
5. Set `LLM_PROVIDER=anthropic` in `.env`

### 14.2 Adding a New Embedding Provider

1. Create `app/core/embeddings/cohere_embedder.py` implementing `BaseEmbedder`
2. Add provider to `embedding_provider` Literal in `config.py`
3. Add branch in `embeddings/factory.py`
4. Set `EMBEDDING_PROVIDER=cohere` in `.env`

### 14.3 Adding a New Agent

1. Create `app/core/agent/your_agent.py`
2. Import `agent_llm` from `app.core.generation.factory`
3. Wire it into `pipeline.py`'s loop
4. Optionally add fields to `AgentState`

### 14.4 Adding a Reranker

The `reranked_results` field in the explain endpoint is ready for a cross-encoder reranker:

1. Create `app/core/retrieval/reranker.py`
2. Add `reranker_provider` to `config.py`
3. In `HybridRetriever.explain()`: after RRF fusion, pass hybrid results through the reranker
4. Populate the `reranked_results` list with reranker scores and previous hybrid ranks

### 14.5 Adding a New Search Mode

1. Add the mode to `search_mode` Literal in `config.py`
2. Add a branch in `HybridRetriever.search()` and `HybridRetriever.explain()`

### 14.6 Adding a New API Route

1. Define request/response models in `app/models/schemas.py`
2. Add route handler in `app/api/routes.py`
3. Delegate to a core function — keep the route thin

### 14.7 Adding a New Vector Store

1. Create a new retriever class (e.g., `app/core/retrieval/pinecone_retriever.py`)
2. Implement `search()` returning `list[SourceDocument]`
3. Update `vector_store_provider` Literal in `config.py`
4. Integrate into `HybridRetriever`

### 14.8 Adding Evaluation Datasets

1. Create a JSON file in `evaluation/data/` with questions and ground truth
2. Run `python -m evaluation.cli --questions evaluation/data/your-file.json`
