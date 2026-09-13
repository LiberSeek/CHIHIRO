# P1 placeholder for a pinned AstrBot release image.
#
# AstrBot remains a separate Python service. The current Chihiro integration
# does not add a product plugin during this phase; this Dockerfile gives the
# release pipeline one stable extension point for that plugin.

ARG ASTRBOT_BASE_IMAGE=soulter/astrbot:latest
FROM ${ASTRBOT_BASE_IMAGE}

LABEL org.opencontainers.image.title="Chihiro AstrBot runtime"
LABEL org.opencontainers.image.description="AstrBot service used by the Chihiro workbench"

EXPOSE 6185
