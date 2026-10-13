export default function LinkArrow({ classes, ...rest }: any) {
    let src = "svg/link_arrow.svg";
    return <>
        <img className={ "link-arrow " + (classes ? classes : "") } {...rest} src={src} />
    </>
}