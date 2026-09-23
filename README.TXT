# JT3D AI V3 — Tripo

Integração do JT3D AI com a API V3 da Tripo.

## Segurança
A chave da Tripo NÃO fica no frontend e NÃO está incluída neste ZIP.
Configure-a somente no servidor:

```bash
cd api
cp .env.example .env
# edite .env e coloque TRIPO_API_KEY=sua_chave
```

## Rodar backend

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API:
- GET `/health`
- POST `/api/gerar-3d`
- GET `/api/tarefa/{task_id}`

Com 2–4 fotos, o backend usa multiview. Com uma foto, usa image-to-model.

A API V3 da Tripo usa `https://openapi.tripo3d.ai/v3`, autenticação Bearer e tarefas assíncronas. Consulte a documentação oficial para limites, créditos e formatos disponíveis.
