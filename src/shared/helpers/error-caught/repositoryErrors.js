import { ref } from 'vue';
import { useToastStore } from '@/shared/stores/toast';
import { useModalStore } from '@/shared/stores/modal';

/**
* Composable de propiedades y funciones para 'Repositorio de Errores'.
*
* @returns {object} Propiedades del Composable 'RepositoryErrors'.  
*/
export const useRepositoryErrors = () => {
    
    //? Instancia de stores
    const toast = useToastStore();

    const modalStore = useModalStore();

    /**
     * @constant {object} Repositorio de Errores Capturados.
     */
    const repositoryErrors = ref({
        // TODO: AGREGUE LOS ERRORES CORRESPONDIENTES PARA CONTROLAR LOS ERRORES DE LAS API
        '[NOMENCLATUA DE ERROR]': (customError) => {
            return toast.openToast({
                message: `${customError.message}`,
                title: `${customError.title}`,
                type: 'error'
            });
        },
    });

    return {
        //* --> Properties
        repositoryErrors,
        
        //* --> Methods
    }

}