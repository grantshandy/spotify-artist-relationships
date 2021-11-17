const client_id = '2ed0e6e8b06842fb854cb15e1690a7b5';
const redirect_uri = window.location.href.split('?')[0].split('#')[0];
const scopes = 'user-follow-read';

const darkColor = '#04080F';
const lightColor = '#EEF0F2';

var cursor = '';

var app = new Vue({
    el: '#app',
    data: {
        auth_key: null,
        me: null,
        nodes: [],
        links: [],
    },
    async created() {
        // Get our authentication key from the URL
        this.auth_key = window.location.hash.substr(1).split('&')[0].split('=')[1];

        // If there was no authentication key in the URL
        if (!this.auth_key) {
            // Try to set it from localStorage
            this.auth_key = localStorage.getItem('spotToken');
        } else {
            // If we have it then set it in localStorage
            localStorage.setItem('spotToken', this.auth_key);
            this.me = await this.getMe();
        }
    },
    async mounted() {
        if (this.auth_key) {
            await this.showFollowing();
        }
    },
    methods: {
        // Go to the authentication page to generate a new token
        authenticate: function() {
            window.location.href = `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=token&redirect_uri=${redirect_uri}&scope=${scopes}&show_dialog=true`;
        },

        // Remove our token and log out
        logout: function() {
            localStorage.removeItem('spotToken');
            window.location.href = window.location.href.split('#')[0];
        },

        // Run a graph that shows your artists
        showFollowing: async function() {
            this.setLoadingText('getting nodes');
            this.nodes = await this.getFollowing();
            this.setLoadingText('building relationships');
            this.links = await this.buildRelationships(this.nodes);

            this.buildGraph();
        },

        // Set the loading text and print it to the console
        setLoadingText: function(text) {
            this.$refs['graph'].innerHTML = '<p class="loadingText">'+text+'</p>';
        },

        // Create a graph from nodes and links
        buildGraph: function() {
            var Graph = ForceGraph3D();
            Graph(this.$refs['graph'])
                .graphData({ nodes: this.nodes, links: this.links })
                .enableNodeDrag(false)
                .showNavInfo(false)
                .enablePointerInteraction(false)
                .nodeColor(node => lightColor)
                .nodeThreeObject(node => {
                  const sprite = new SpriteText(node.name);
                  sprite.material.depthWrite = false; // make sprite background transparent
                  sprite.color = lightColor;
                  sprite.textHeight = 8;
                  return sprite;
                })
                .width(this.$refs['graphContainer'].clientWidth)
                .height(this.$refs['graphContainer'].clientHeight)
                .backgroundColor(darkColor);
        },

        // Build the relationships between nodes
        buildRelationships: async function(nodes) {
            var links = new Array();
            var idArray = new Array();

            nodes.forEach(function(artist) {
                idArray.push(artist.id);
            });

            for await (const artist of nodes) {
                var relatedArtists = await this.getRelated(artist);
                for (const relatedArtist of relatedArtists) {
                    if (idArray.includes(relatedArtist.id)) {
                        var potentialConnection = { source: artist.id, target: relatedArtist.id };
                        var reversedPotentialConnection = { source: relatedArtist.id, target: artist.id };

                        if (!links.includes(potentialConnection) && !links.includes(reversedPotentialConnection)) {
                            links.push(potentialConnection);
                        }
                    }
                }
            }

            return links;
        },

        // Get information about the user
        getMe: async function() {
            return new Promise((resolve, reject) => {
                fetch('https://api.spotify.com/v1/me', {
                    headers: {
                        'Authorization': `Bearer ${this.auth_key}`,
                    },
                })
                .then(response => response.json())
                .then(response => {
                    if (response.error) {
                        reject(response.error);
                    }
        
                    resolve(response)
                })
                .catch(error => reject(error));
            })
        },

        // Get the related artists from an artist
        getRelated: async function(artist) {
            return new Promise((resolve, reject) => {
                fetch(`https://api.spotify.com/v1/artists/${artist.id}/related-artists`, {
                    headers: {
                        'Authorization': `Bearer ${this.auth_key}`,
                    },
                })
                .then(response => response.json())
                .then(response => {
                    if (response.error) {
                        reject(response.error);
                    }
        
                    var relatedArtists = new Array ();

                    response.artists.forEach(function(artist) {
                      relatedArtists.push({ name: artist.name, id: artist.id });
                    }); 
            
                    resolve(relatedArtists)
                })
                .catch(error => reject(error));
            })
        },

        // Get who we follow
        getFollowing: async function() {
            var totalFollowing = await get();
            while (cursor != null) {  
                var moreFollowing = await get(cursor);
                moreFollowing.forEach(function(x) {
                    totalFollowing.push(x);
                });
            }

            return totalFollowing;

            async function get(last) {
                var url;

                if (last == null) {
                    url = 'https://api.spotify.com/v1/me/following?type=artist&limit=50';
                } else {
                    url = `https://api.spotify.com/v1/me/following?type=artist&after=${last}&limit=50`;
                }

                return new Promise((resolve, reject) => {
                    fetch(url, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('spotToken')}`,
                        },
                    })
                    .then(response => response.json())
                    .then(response => {
                        if (response.error) {
                            reject(response.error);
                        }

                        var artists = new Array ();

                        response.artists.items.forEach(function(artist) {
                            artists.push({ name: artist.name, id: artist.id });
                        });
        
                        cursor = response.artists.cursors.after;
            
                        resolve(artists)
                    })
                    .catch(error => reject(error));
                })
            }      
        }
    }
})