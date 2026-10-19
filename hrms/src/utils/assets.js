import applogo from '../assets/icons/Icon.svg'
import ContainerImg from '../assets/images/Container.png'
export const icons = {
    applogo
}

export const images = {
    ContainerImg
}


export function capitalizeFirstLetter(str) {
    if (!str || typeof str !== "string") return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}
