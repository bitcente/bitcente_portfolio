type TagProps = React.HTMLAttributes<HTMLDivElement> & { invertstate?: boolean; text?: React.ReactNode };

export default function Tag({ invertstate, text, className = '', ...rest }: TagProps) {

    return <>
        <div className={ "p-tag " + (invertstate ? "invert " : "") + className } {...rest}>
            <svg xmlns="http://www.w3.org/2000/svg" className="p-tag__svg-left" viewBox="0 0 10.017 22.035"><g transform="translate(0 0.035)"><rect width="4" height="2" transform="matrix(1, 0.017, -0.017, 1, 6.018, -0.035)" /><rect width="4" height="2" transform="translate(6 20)" /><g transform="translate(0 2)"><rect width="14" height="2" transform="translate(2 2) rotate(90)"/><rect width="4" height="2" transform="translate(2 16)"/><rect width="4" height="2" transform="translate(2)"/></g></g></svg>
            <span className="p-tag__top-bar"></span>
            <span className="text-xs">{ text }</span>
            <span className="p-tag__bottom-bar"></span>
            <svg xmlns="http://www.w3.org/2000/svg" className="p-tag__svg-right" viewBox="0 0 10.017 22.035"><g transform="translate(0)"><rect width="4" height="2" transform="matrix(-1, 0.017, -0.017, -1, 4.034, 2)" /><rect width="4" height="2" transform="translate(0.017 20.035)" /><g transform="translate(4.017 2.035)"><rect width="14" height="2" transform="translate(6 2) rotate(90)" /><rect width="4" height="2" transform="translate(0 16)"/><rect width="4" height="2" transform="translate(0)"/></g></g></svg>
        </div>
    </>
}