import { nip19 } from "nostr-tools";
import type { EventPointer, ProfilePointer } from "nostr-tools/lib/nip19";

import type { NDKTag } from "./index.js";

export type ContentTag = {
    tags: NDKTag[];
    content: string;
};

export async function generateContentTags(
    content: string,
    tags: NDKTag[] = []
): Promise<ContentTag> {
    const tagRegex = /(@|nostr:)(npub|nprofile|note|nevent|naddr)[a-zA-Z0-9]+/g;
    const hashtagRegex = /#(\w+)/g;
    let promises: Promise<void>[] = [];

    const addTagIfNew = (t: NDKTag) => {
        if (!tags.find((t2) => t2[0] === t[0] && t2[1] === t[1])) {
            tags.push(t);
        }
    }

    content = content.replace(tagRegex, (tag) => {
        try {
            const entity = tag.split(/(@|nostr:)/)[2];
            const { type, data } = nip19.decode(entity);
            let t: NDKTag | undefined;

            switch (type) {
                case "npub":
                    t = ["p", data as string];
                    break;

                case "nprofile":
                    t = ["p", (data as ProfilePointer).pubkey as string];
                    break;

                case "note":
                    promises.push(new Promise(async (resolve) => {
                        addTagIfNew(["e", data, await maybeGetEventRelayUrl(entity), "mention"]);
                        resolve();
                    }));
                    break;

                case "nevent":
                    promises.push(new Promise(async (resolve) => {
                        let { id, relays, author } = data as EventPointer;

                        // If the nevent doesn't have a relay specified, try to get one
                        if (!relays || relays.length === 0) {
                            relays = [
                                await maybeGetEventRelayUrl(entity)
                            ];
                        }

                        addTagIfNew(["e", id, relays[0], "mention"]);
                        if (author) addTagIfNew(["p", author]);
                        resolve();
                    }));
                    break;

                case "naddr":
                    promises.push(new Promise(async (resolve) => {
                        const id = [data.kind, data.pubkey, data.identifier].join(":");
                        let relays = data.relays ?? [];

                        // If the naddr doesn't have a relay specified, try to get one
                        if (relays.length === 0) {
                            relays = [
                                await maybeGetEventRelayUrl(entity)
                            ];
                        }

                        addTagIfNew(["a", id, relays[0], "mention"]);
                        addTagIfNew(["p", data.pubkey]);
                        resolve();
                    }));
                    break;
                default:
                    return tag;
            }

            if (t) addTagIfNew(t);

            return `nostr:${entity}`;
        } catch (error) {
            return tag;
        }
    });

    await Promise.all(promises);

    content = content.replace(hashtagRegex, (tag, word) => {
        const t: NDKTag = ["t", word];
        if (!tags.find((t2) => t2[0] === t[0] && t2[1] === t[1])) {
            tags.push(t);
        }
        return tag; // keep the original tag in the content
    });

    return { content, tags };
}

/**
 * Get the event from the cache, if there is one, so we can get the relay.
 * @param nip19Id
 * @returns Relay URL or an empty string
 */
async function maybeGetEventRelayUrl(nip19Id: string): Promise<string> {
    /* TODO */

    return "";
}