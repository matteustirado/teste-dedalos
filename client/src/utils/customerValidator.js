// client/src/utils/customerValidator.js

const MASTER_CODE = '0108';

const API_URLS = {
    // Normaliza para maiúsculo para garantir o match
    SP: 'https://dedalosadm2-3dab78314381.herokuapp.com/pesquisa/api/verificar_pulseira/',
    BH: 'https://dedalosadm2bh-09d55dca461e.herokuapp.com/pesquisa/api/verificar_pulseira/'
};

/**
 * Valida o código do cliente (Pulseira/Comanda)
 * @param {string} code - O código digitado
 * @param {string} unit - A unidade ('SP' ou 'BH')
 * @returns {Promise<boolean>} - True se válido, False se inválido
 */
export const validateCustomerCode = async (code, unit) => {
    if (!code) return false;

    const cleanCode = code.toString().trim();
    
    // 1. Validação do Código Mestre
    if (cleanCode === MASTER_CODE) {
        return true;
    }

    // 2. Identifica a URL base pela unidade (Default para SP se não vier nada)
    const currentUnit = unit ? unit.toUpperCase() : 'SP';
    const baseUrl = API_URLS[currentUnit] || API_URLS.SP;

    // Constrói a URL completa
    const url = `${baseUrl}?id=${cleanCode.toUpperCase()}`;

    try {
        const response = await fetch(url);
        // A API retorna 200 (OK) se a pulseira existe/é válida
        return response.ok;
    } catch (error) {
        console.error(`Erro ao validar código na unidade ${currentUnit}:`, error);
        return false; // Assume inválido em caso de erro de rede para segurança
    }
};