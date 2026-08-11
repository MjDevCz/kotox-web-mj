import {CMS_INTRO} from '../lib/constants'

const Intro = () => {
    // CMS_INTRO is the single source of truth (e.g. "Mobile craftsmanship stories").
    // Bold everything but the trailing word to keep the existing "<b>…</b> stories" look.
    const words = CMS_INTRO.split(' ')
    const lead = words.slice(0, -1).join(' ')
    const tail = words[words.length - 1]

    return (
        <section className="flex-col md:flex-row flex items-center md:justify-between mt-16 mb-16 md:mb-12">
            <h1 className="text-5xl md:text-8xl font-bold tracking-tighter leading-tight md:pr-8">
                MJ Stories
            </h1>
            <h4 className="text-center md:text-left text-lg mt-5 md:pl-8">
                <b> {lead}</b> {tail}
            </h4>
        </section>
    )
}

export default Intro