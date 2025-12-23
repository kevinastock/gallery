# Gallery

Static photo gallery generator with justified layout and photoswipe.
[Here's an example gallery](https://kevinstock.org/africa).
I've only confirmed this looks ok on my laptop and cell phone. I should try it on larger screens.

    usage: generate_gallery.py [-h] [--header HEADER] [--footer FOOTER] [--dev] [--limit LIMIT] [--overwrite] [--shuffle] [--download] [--margin MARGIN]
                               [--favicon-emoji FAVICON_EMOJI]
                               input_dir output_dir

    Generate a static justified photo gallery.

    positional arguments:
      input_dir             Directory of images to include
      output_dir            Directory to write the static site

    options:
      -h, --help            show this help message and exit
      --header HEADER       Header text for the page
      --footer FOOTER       Footer attribution text
      --dev                 Use fastest image compression for quick iteration
      --limit LIMIT         Only process the first N images (requires --dev)
      --overwrite           Overwrite output directory if it already exists
      --shuffle             Randomize the order of discovered images
      --download            Include original images and enable the lightbox download button
      --margin MARGIN       Justified layout margin size between photos in pixels (default: 4)
      --favicon-emoji FAVICON_EMOJI
                            Emoji to embed in the favicon (default: 📸)
