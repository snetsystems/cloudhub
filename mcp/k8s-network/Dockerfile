FROM golang:1.25-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/k8s-network-mcp ./cmd/k8s-network-mcp

FROM alpine:3.22

RUN apk add --no-cache ca-certificates \
    && addgroup -S mcp \
    && adduser -S -G mcp mcp

COPY --from=build /out/k8s-network-mcp /k8s-network-mcp

USER mcp
EXPOSE 8080
ENTRYPOINT ["/k8s-network-mcp"]
