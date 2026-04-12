import cn from "classnames";
import {EXAMPLE_PATH} from "../lib/constants";
import Link from "next/link";

const SocialsView = (preview) => {
    return (
        <div className="bg-neutral-50 border-t border-neutral-200 p-4">
            <div className="flex items-center">
                <span className="rounded outline p-1 text-left text-lg mr-4 font-semibold truncate">
                    <Link as={`/posts/aboutme`} href="/posts/[slug]">
                           About me
                        </Link>
                </span>

                <a href={`mailto:jenicek.michal@gmail.com`}>
                    <img src="/assets/blog/social/email.png" className="w-10 h-10 p2 mr-4" alt=""/>
                </a>
                <a href={`https://github.com/kotoMJ`} target="_blank">
                    <img src="/assets/blog/social/github.png" className="w-10 h-10 p2 mr-4" alt=""/>
                </a>
                <a href={`https://www.linkedin.com/in/jenicekmichal/`} target="_blank">
                    <img src="/assets/blog/social/linkedin.png" className="w-10 h-10 p2 mr-4" alt=""/>
                </a>
                <a href={`https://twitter.com/kotomisak`} target="_blank">
                    <img src="/assets/blog/social/twitter.png" className="w-10 h-10 p2 mr-4" alt=""/>
                </a>
                <a href={`https://www.instagram.com/jenicek.michal/`} target="_blank">
                    <img src="/assets/blog/social/instagram.png" className="w-10 h-10 p2 mr-4" alt=""/>
                </a>
                <a href={`https://www.facebook.com/kotomisak`} target="_blank">
                    <img src="/assets/blog/social/facebook.png" className="w-10 h-10 p2 mr-4" alt=""/>
                </a>
                <a href={`https://dev.to/mjdev`} target="_blank">
                    <img src="/assets/blog/social/devto.png" className="w-10 h-10 p2 mr-4" alt=""/>
                </a>
            </div>
        </div>
    )
}

export default SocialsView
