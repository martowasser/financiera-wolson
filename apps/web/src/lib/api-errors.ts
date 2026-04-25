import { ApiError } from './api';

// Codes come from the backend's AppError (apps/api/src/lib/errors.ts) plus the
// throw sites across modules. Keep in sync when new error codes are introduced.
export const ERROR_MESSAGES: Record<string, string> = {
  // Generic
  NOT_FOUND: 'No se encontró el recurso.',
  UNAUTHORIZED: 'Sesión expirada. Volvé a iniciar sesión.',
  FORBIDDEN: 'No tenés permiso para esta acción.',
  BAD_REQUEST: 'Pedido inválido.',
  CONFLICT: 'Hay un conflicto con los datos.',
  UNPROCESSABLE_ENTITY: 'No se puede procesar el pedido.',
  VALIDATION_ERROR: 'Faltan datos o hay algún campo inválido.',
  RATE_LIMIT_EXCEEDED: 'Demasiados intentos. Probá en un rato.',
  INTERNAL_SERVER_ERROR: 'Error del servidor. Probá de nuevo o avisá al admin.',

  // Caja
  CAJA_CLOSED: 'La caja de ese día está cerrada. Reabrila o usá otra fecha.',
  CAJA_ALREADY_CLOSED: 'La caja ya estaba cerrada.',
  CAJA_ALREADY_OPEN: 'La caja ya estaba abierta.',
  CAJA_NEXT_DAY_HAS_MOVIMIENTOS: 'No se puede reabrir: el día siguiente ya tiene movimientos.',

  // Movimiento
  MOV_BUCKET_REQUIRED: 'Falta indicar de dónde sale o a dónde va.',
  MOV_BUCKET_NOT_ALLOWED: 'Ese tipo de movimiento no permite el bucket elegido.',
  MOV_BANCO_ID_REQUIRED: 'Falta elegir el banco.',
  MOV_CUENTA_ID_REQUIRED: 'Falta elegir la cuenta corriente.',
  MOV_CAJA_NO_REF: 'Para caja física no corresponde elegir banco ni cuenta.',
  MOV_FLOW_INGRESO: 'Este tipo es solo de ingreso (no lleva origen).',
  MOV_FLOW_EGRESO: 'Este tipo es solo de egreso (no lleva destino).',
  MOV_TRANSFER_SAME: 'Origen y destino no pueden ser iguales.',
  MOV_BUCKET_MISSING: 'Indicá al menos origen o destino.',
  MOV_NOTES_REQUIRED: 'Este tipo requiere que cargues notas.',
  MOV_ALQUILER_REQUIRED: 'Falta elegir el alquiler.',
  MOV_PROPIEDAD_REQUIRED: 'Falta elegir la propiedad.',
  MOV_SOCIEDAD_REQUIRED: 'Falta elegir la sociedad.',

  // Alquiler
  ALQUILER_SOCIOS_DUPLICATE_CUENTA: 'Hay una cuenta duplicada en los socios del alquiler.',
  ALQUILER_SOCIOS_PERCENT_SUM_INVALID: 'Los porcentajes de socios del alquiler deben sumar 100%.',
  ALQUILER_SOCIOS_CUENTA_INVALID: 'Alguna cuenta elegida como socio no existe o está inactiva.',
  ALQUILER_SOCIOS_EMPTY: 'Falta indicar los socios del alquiler.',
  ALQUILER_YA_FINALIZADO: 'El alquiler ya estaba finalizado.',
  ALQUILER_YA_ACTIVO: 'El alquiler ya estaba activo.',
  ALQUILER_HAS_MOVIMIENTOS: 'No se puede eliminar: el alquiler tiene movimientos cargados.',
  PROPIEDAD_NOT_FOUND: 'La propiedad no existe o fue eliminada.',
  INQUILINO_NOT_FOUND: 'El inquilino no existe o fue eliminado.',

  // Sociedad
  SOCIEDAD_SOCIOS_DUPLICATE_CUENTA: 'Hay una cuenta duplicada en los socios de la sociedad.',
  SOCIEDAD_SOCIOS_PERCENT_SUM_INVALID: 'Los porcentajes de socios deben sumar 100%.',
  SOCIEDAD_SOCIOS_CUENTA_INVALID: 'Alguna cuenta elegida como socio no existe o está inactiva.',
  SOCIEDAD_HAS_DEPENDENCIES: 'No se puede eliminar: la sociedad tiene propiedades activas o movimientos.',
  SOCIEDAD_NOT_FOUND: 'La sociedad no existe o fue eliminada.',

  // Banco
  BANCO_ALREADY_EXISTS_FOR_SOCIEDAD: 'Esa sociedad ya tiene un banco asociado.',

  // Cuenta
  CUENTA_HAS_DEPENDENCIES: 'No se puede eliminar: la cuenta participa de sociedades, alquileres o como inquilino.',

  // Propiedad
  PROPIEDAD_HAS_DEPENDENCIES: 'No se puede eliminar: la propiedad tiene alquileres activos o movimientos.',
};

export function formatApiError(e: unknown, fallback = 'Ocurrió un error. Probá de nuevo.'): string {
  if (e instanceof ApiError) {
    const mapped = ERROR_MESSAGES[e.code];
    if (mapped) return mapped;
    // Unmapped code: prefer the backend's Spanish message over the generic fallback,
    // but avoid leaking apiFetch's "Request failed with status N" when the body couldn't
    // be parsed.
    if (e.message && !e.message.startsWith('Request failed with status')) return e.message;
    return fallback;
  }
  // fetch() network failures surface as TypeError('Failed to fetch') — unhelpful for Mariana.
  if (e instanceof TypeError) return 'Error de conexión.';
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
