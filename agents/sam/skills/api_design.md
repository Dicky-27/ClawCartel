# Skill: API Design

## Capability
Design robust, scalable APIs (REST, GraphQL, gRPC). Create clear contracts that frontend and backend can rely on.

## When to Use
- New API endpoints
- API refactoring
- Version planning
- Performance optimization

## Process

### REST Design Principles
- **Resource-based**: `/users` not `/getUsers`
- **HTTP methods**: GET, POST, PUT, PATCH, DELETE
- **Status codes**: 200, 201, 400, 401, 403, 404, 500 appropriately
- **Versioning**: `/v1/users` or header-based

### GraphQL Design Principles
- **Schema-first**: Types, queries, mutations defined
- **Resolver efficiency**: Avoid N+1 queries (use DataLoader)
- **Field authorization**: Per-field access control
- **Query complexity**: Limit depth and cost

### API Contract Elements
```typescript
interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  request: {
    params?: Record<string, type>;
    query?: Record<string, type>;
    body?: Record<string, type>;
  };
  response: {
    status: number;
    body: Record<string, type>;
  };
  errors: ErrorCode[];
  auth: 'public' | 'user' | 'admin';
  rateLimit?: string;
}
```

## Tools
- `design_rest_endpoint(spec)` → Returns REST contract
- `design_graphql_schema(types[])` → Returns GraphQL schema
- `check_n_plus_one(query)` → Returns optimization suggestions

## Examples

### Example 1: REST API Design
**Requirement**: User profile management

**Sam's Design**:
```yaml
GET /v1/users/:id
  Auth: Bearer token
  Response: { id, name, email, avatar, createdAt }
  Errors: 401 (unauth), 404 (not found)

PATCH /v1/users/:id
  Auth: Bearer token (own profile only)
  Body: { name?, email?, avatar? }
  Response: 200 + updated user
  Errors: 400 (validation), 401, 403 (not owner), 409 (email exists)

DELETE /v1/users/:id
  Auth: Bearer token (own profile or admin)
  Response: 204
  Errors: 401, 403, 404
```

### Example 2: GraphQL N+1 Fix
**Input**: Query fetching users and their posts is slow

**Sam's Analysis**:
> "**Issue**: N+1 query problem. One query for users, N queries for posts.
> 
> **Fix**: Implement DataLoader for batching.
> 
> ```typescript
> const userLoader = new DataLoader(async (userIds) => {
>   const users = await db.users.findMany({
>     where: { id: { in: userIds } },
>     include: { posts: true } // Single query
>   });
>   return userIds.map(id => users.find(u => u.id === id));
> });
> ```"

## Limitations
- Does not design frontend component structure (defer to @jordan)
- Complex business logic validation may need domain expert
- Performance estimates need load testing confirmation

## Sam's API Rules
1. **Always version** — breaking changes need new version
2. **Always validate** — never trust client input
3. **Always document** — OpenAPI/GraphQL introspection
4. **Always rate limit** — protect against abuse
