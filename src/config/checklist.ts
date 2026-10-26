import { CategoryData } from "@/components/Checklist";

export interface ChecklistItemConfig {
  id: string;
  name: string;
  requirePhotoAlways?: boolean;
}

export interface ChecklistCategoryConfig {
  category: string;
  description?: string;
  items: ChecklistItemConfig[];
}

/**
 * Configuração do Checklist Enxuto (~5 minutos)
 * Controle interno de entrada e saída de veículos.
 * (Dados de Identificação — placa, chassi, KM, combustível — ficam na etapa de identificação da movimentação).
 */
export const CHECKLIST_CONFIG: ChecklistCategoryConfig[] = [
  {
    category: "Itens e Acessórios",
    description: "Presença e funcionamento dos acessórios do veículo",
    items: [
      { id: "acc-estepe", name: "Estepe" },
      { id: "acc-macaco", name: "Macaco" },
      { id: "acc-chave-roda", name: "Chave de Roda" },
      { id: "acc-triangulo", name: "Triângulo" },
      { id: "acc-chave-reserva", name: "Chave Reserva" },
      { id: "acc-manual", name: "Manual do Proprietário" },
      { id: "acc-tapetes", name: "Tapetes" },
      { id: "acc-som", name: "Som / Multimídia" },
    ],
  },
  {
    category: "Condição Geral",
    description: "Avaliação geral (OK = Bom, Atenção = Regular, Defeito = Ruim)",
    items: [
      { id: "cond-pneus", name: "Pneus" },
      { id: "cond-vidros", name: "Vidros" },
      { id: "cond-farois", name: "Faróis e Lanternas" },
      { id: "cond-interior", name: "Interior (Bancos, Teto e Acabamentos)" },
      { id: "cond-lataria", name: "Lataria e Pintura" },
      { id: "cond-painel", name: "Painel sem Luzes de Alerta" },
    ],
  },
  {
    category: "Documentos Recebidos / Entregues",
    description: "Conferência de documentação e itens entregues",
    items: [
      { id: "doc-crlv", name: "CRLV (Documento do Veículo)" },
      { id: "doc-nf", name: "Nota Fiscal / Recibo" },
      { id: "doc-chave-reserva", name: "Chave Reserva (Conferência Documental)" },
      { id: "doc-outros", name: "Outros Documentos / Pertences" },
    ],
  },
];

/**
 * Gera o estado inicial do checklist limpo para uma nova vistoria.
 */
export function createInitialChecklistState(): CategoryData[] {
  return CHECKLIST_CONFIG.map((cat) => ({
    category: cat.category,
    items: cat.items.map((item) => ({
      id: item.id,
      name: item.name,
      status: null,
      photoUrl: null,
      observation: "",
      requirePhotoAlways: item.requirePhotoAlways,
    })),
  }));
}
