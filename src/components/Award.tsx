export default function Award({ ishovered, classes, ...rest }: any) {
    let src = "svg/award.svg";
    if (!ishovered) {
        src = "svg/award_unhovered.svg";
    }
    return <>
        <img className={ "award " + (classes ? classes : "") } {...rest} src={src} />
    </>
}