import { computed } from "vue";
import { useRoute } from "vue-router";

export type ChihiroEmbedMode = "full" | "sidebar" | "thread" | null;

export function useChihiroEmbed() {
  const route = useRoute();
  const embedValue = computed(() => {
    const raw = route.query.embed;
    return Array.isArray(raw) ? raw[0] : raw;
  });
  const embedMode = computed<ChihiroEmbedMode>(() => {
    const value = embedValue.value;
    if (value === "chihiro-sidebar") return "sidebar";
    if (value === "chihiro-thread") return "thread";
    if (value === "chihiro" || value === "1") return "full";
    return null;
  });
  const isChihiroEmbed = computed(() => embedMode.value !== null);
  const isChihiroSidebar = computed(() => embedMode.value === "sidebar");
  const isChihiroThread = computed(() => embedMode.value === "thread");
  return { embedMode, isChihiroEmbed, isChihiroSidebar, isChihiroThread };
}
